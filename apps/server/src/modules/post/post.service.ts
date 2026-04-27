import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type {
  EvaluationDto,
  PostAuthorDto,
  PostCommentDto,
  PostDto,
  PostListDto,
  PostType,
  ReportFilter,
} from '@momoya/shared';
import {
  DAILY_TAG_MAX_PER_POST,
  POST_COMMENT_MAX,
  POST_COMMENT_PAGE_SIZE,
  POST_COMMENT_PREVIEW,
  POST_IMAGE_MAX,
  POST_TEXT_MAX,
  REPORT_TAG_MAX,
  REPORT_TAG_MIN,
  TAG_NAME_MAX,
} from '@momoya/shared';
import type { PostCommentPageDto } from '@momoya/shared';
import { makeCoupleKey } from '../../common/couple-key';
import { ErrorKey } from '../../common/constants/error-keys';
import { toDate, toIsoString } from '../../common/utils/date';
import { TagService } from '../tag/tag.service';
import { CoupleRealtimeService } from '../realtime/couple-realtime.service';
import { UserService } from '../user/user.service';
import type { UserDocument } from '../user/schemas/user.schema';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsQueryDto } from './dto/list-posts.query.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { Evaluation, EvaluationDocument } from './schemas/evaluation.schema';
import {
  PostComment,
  PostCommentDocument,
} from './schemas/post-comment.schema';
import { Post, PostDocument } from './schemas/post.schema';

const DEFAULT_LIMIT = 20;

@Injectable()
export class PostService {
  constructor(
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    @InjectModel(Evaluation.name)
    private readonly evaluationModel: Model<EvaluationDocument>,
    @InjectModel(PostComment.name)
    private readonly postCommentModel: Model<PostCommentDocument>,
    private readonly userService: UserService,
    private readonly tagService: TagService,
    private readonly coupleRealtime: CoupleRealtimeService,
  ) {}

  async create(authorId: string, dto: CreatePostDto): Promise<PostDto> {
    const text = (dto.text ?? '').trim();
    const images = (dto.images ?? []).slice(0, POST_IMAGE_MAX);
    const tags = dedupeTags(dto.tags ?? []);

    if (text.length > POST_TEXT_MAX) {
      throw new BadRequestException({
        message: `text 超长（上限 ${POST_TEXT_MAX}）`,
        errorKey: ErrorKey.E_VALIDATION,
      });
    }

    this.validateTags(dto.type, tags);
    await this.ensureReportTagsAllowed(authorId, dto.type, tags);

    if (!text && images.length === 0) {
      throw new BadRequestException({
        message: 'text 与 images 不能同时为空',
        errorKey: ErrorKey.E_VALIDATION,
      });
    }

    const happenedAt = dto.happenedAt ? new Date(dto.happenedAt) : new Date();

    const doc = await this.postModel.create({
      authorId: new Types.ObjectId(authorId),
      type: dto.type,
      text,
      images,
      tags,
      happenedAt,
    });

    const authorMap = await this.loadAuthorMap([doc.authorId]);
    const emptyComments = { comments: [] as PostCommentDto[], commentCount: 0 };
    const postDto = this.toDto(doc, authorMap, null, emptyComments, authorId);
    const ck = await this.coupleKeyForUser(authorId);
    if (ck) {
      if (postDto.type === 'daily') {
        this.coupleRealtime.emitDailyCreated(ck, postDto);
      } else if (postDto.type === 'report') {
        this.coupleRealtime.emitReportCreated(ck, postDto);
      }
    }
    return postDto;
  }

  async update(
    authorId: string,
    postId: string,
    dto: UpdatePostDto,
  ): Promise<PostDto> {
    const doc = await this.mustFindOwnPost(authorId, postId);

    const next: Partial<Pick<Post, 'text' | 'images' | 'tags' | 'happenedAt'>> =
      {};
    if (dto.text !== undefined) {
      const text = dto.text.trim();
      if (text.length > POST_TEXT_MAX) {
        throw new BadRequestException({
          message: `text 超长（上限 ${POST_TEXT_MAX}）`,
          errorKey: ErrorKey.E_VALIDATION,
        });
      }
      next.text = text;
    }
    if (dto.images !== undefined) {
      next.images = dto.images.slice(0, POST_IMAGE_MAX);
    }
    if (dto.tags !== undefined) {
      const tags = dedupeTags(dto.tags);
      this.validateTags(doc.type, tags);
      await this.ensureReportTagsAllowed(authorId, doc.type, tags);
      next.tags = tags;
    }
    if (dto.happenedAt !== undefined) {
      next.happenedAt = new Date(dto.happenedAt);
    }

    const mergedText = next.text ?? doc.text;
    const mergedImages = next.images ?? doc.images;
    if (!mergedText.trim() && mergedImages.length === 0) {
      throw new BadRequestException({
        message: 'text 与 images 不能同时为空',
        errorKey: ErrorKey.E_VALIDATION,
      });
    }

    const hadChanges = Object.keys(next).length > 0;
    if (hadChanges) {
      Object.assign(doc, next);
      await doc.save();
    }

    const authorMap = await this.loadAuthorMap([doc.authorId]);
    const evaluation = await this.loadEvaluation(String(doc._id));
    const commentBlock = await this.loadCommentBlockForPosts(
      [doc._id],
      authorId,
    );
    const postDto = this.toDto(
      doc,
      authorMap,
      evaluation,
      commentBlock.get(String(doc._id)) ?? {
        comments: [],
        commentCount: 0,
      },
      authorId,
    );
    if (hadChanges) {
      const ck = await this.coupleKeyForUser(authorId);
      if (ck) {
        if (doc.type === 'daily') {
          this.coupleRealtime.emitDailyUpdated(ck, postDto);
        } else if (doc.type === 'report') {
          this.coupleRealtime.emitReportUpdated(ck, postDto);
        }
      }
    }
    return postDto;
  }

  async detail(
    userId: string,
    postId: string,
    partnerId: string | null,
  ): Promise<PostDto> {
    const doc = await this.mustFindVisiblePost(userId, partnerId, postId);
    const authorMap = await this.loadAuthorMap([doc.authorId]);
    const evaluation = await this.loadEvaluation(String(doc._id));
    const commentBlock = await this.loadCommentBlockForPosts([doc._id], userId);
    return this.toDto(
      doc,
      authorMap,
      evaluation,
      commentBlock.get(String(doc._id)) ?? {
        comments: [],
        commentCount: 0,
      },
      userId,
    );
  }

  /**
   * 对可见 daily post 发表一级评论或二级回复（作者或 partner 皆可）。
   * 规则：
   * - 仅 `type=daily` 允许评论；报备禁止。
   * - `parentId` 若不为空，必须指向同 postId 下一条未删的一级评论，否则 depth/not-found。
   */
  async addComment(
    userId: string,
    partnerId: string | null,
    postId: string,
    text: string,
    parentId: string | null | undefined,
  ): Promise<PostCommentDto> {
    const doc = await this.mustFindVisiblePost(userId, partnerId, postId);
    if (doc.type !== 'daily') {
      throw new BadRequestException({
        message: '报备不支持评论',
        errorKey: ErrorKey.E_POST_TYPE_MISMATCH,
      });
    }
    const trimmed = text.trim();
    if (!trimmed) {
      throw new BadRequestException({
        message: '评论不能为空',
        errorKey: ErrorKey.E_VALIDATION,
      });
    }
    if (trimmed.length > POST_COMMENT_MAX) {
      throw new BadRequestException({
        message: `评论过长（上限 ${POST_COMMENT_MAX}）`,
        errorKey: ErrorKey.E_VALIDATION,
      });
    }

    let parentObjectId: Types.ObjectId | null = null;
    if (parentId) {
      if (!Types.ObjectId.isValid(parentId)) {
        throw new NotFoundException({
          message: '父评论不存在',
          errorKey: ErrorKey.E_POST_COMMENT_NOT_FOUND,
        });
      }
      const parent = await this.postCommentModel.findById(parentId).exec();
      if (
        !parent ||
        parent.deletedAt ||
        String(parent.postId) !== String(doc._id)
      ) {
        throw new NotFoundException({
          message: '父评论不存在',
          errorKey: ErrorKey.E_POST_COMMENT_NOT_FOUND,
        });
      }
      if (parent.parentId) {
        throw new BadRequestException({
          message: '回复不能再被回复',
          errorKey: ErrorKey.E_POST_COMMENT_DEPTH,
        });
      }
      parentObjectId = parent._id;
    }

    const c = await this.postCommentModel.create({
      postId: doc._id,
      authorId: new Types.ObjectId(userId),
      parentId: parentObjectId,
      text: trimmed,
    });

    const authorMap = await this.loadAuthorMap([c.authorId]);
    const dto = this.toPostCommentDto(c, authorMap, userId, /*locked*/ false);
    const ck = await this.coupleKeyForUser(userId);
    if (ck) {
      this.coupleRealtime.emitCommentAdded(
        ck,
        String(doc._id),
        dto,
        dto.parentId,
      );
    }
    return dto;
  }

  /** 编辑评论：仅作者本人可改，软锁/硬锁都不影响编辑；会打 `editedAt`。 */
  async editComment(
    userId: string,
    partnerId: string | null,
    postId: string,
    commentId: string,
    text: string,
  ): Promise<PostCommentDto> {
    const { postDoc, comment } = await this.mustFindVisibleComment(
      userId,
      partnerId,
      postId,
      commentId,
    );
    if (String(comment.authorId) !== userId) {
      throw new ForbiddenException({
        message: '只能编辑自己的评论',
        errorKey: ErrorKey.E_POST_COMMENT_FORBIDDEN,
      });
    }
    const trimmed = text.trim();
    if (!trimmed) {
      throw new BadRequestException({
        message: '评论不能为空',
        errorKey: ErrorKey.E_VALIDATION,
      });
    }
    if (trimmed.length > POST_COMMENT_MAX) {
      throw new BadRequestException({
        message: `评论过长（上限 ${POST_COMMENT_MAX}）`,
        errorKey: ErrorKey.E_VALIDATION,
      });
    }

    const changed = trimmed !== comment.text;
    if (changed) {
      comment.text = trimmed;
      comment.editedAt = new Date();
      await comment.save();
    }

    const locked = comment.parentId
      ? false
      : await this.hasLiveReplies(comment._id);
    const authorMap = await this.loadAuthorMap([comment.authorId]);
    const dto = this.toPostCommentDto(comment, authorMap, userId, locked);
    if (changed) {
      const ck = await this.coupleKeyForUser(userId);
      if (ck) {
        this.coupleRealtime.emitCommentUpdated(ck, String(postDoc._id), dto);
      }
    }
    return dto;
  }

  /**
   * 删除评论（软删）：
   * - 回复：作者本人随时可删；
   * - 一级评论：作者本人仅在**没有未删回复**时才可删；有回复返回 `E_POST_COMMENT_LOCKED`。
   */
  async removeComment(
    userId: string,
    partnerId: string | null,
    postId: string,
    commentId: string,
  ): Promise<void> {
    const { postDoc, comment } = await this.mustFindVisibleComment(
      userId,
      partnerId,
      postId,
      commentId,
    );
    if (String(comment.authorId) !== userId) {
      throw new ForbiddenException({
        message: '只能删除自己的评论',
        errorKey: ErrorKey.E_POST_COMMENT_FORBIDDEN,
      });
    }
    if (!comment.parentId) {
      const locked = await this.hasLiveReplies(comment._id);
      if (locked) {
        throw new ForbiddenException({
          message: '已有回复的一级评论只能编辑，不能删除',
          errorKey: ErrorKey.E_POST_COMMENT_LOCKED,
        });
      }
    }
    const parentIdStr = comment.parentId ? String(comment.parentId) : null;
    comment.deletedAt = new Date();
    await comment.save();
    const ck = await this.coupleKeyForUser(userId);
    if (ck) {
      this.coupleRealtime.emitCommentDeleted(
        ck,
        String(postDoc._id),
        String(comment._id),
        parentIdStr,
      );
    }
  }

  /**
   * 详情页评论列表：按一级评论分页，每条一级评论内联返回其全部未删回复。
   * cursor 结构为 `${createdAt.ms}_${_id.hex}`；按 createdAt 升序、_id 升序。
   */
  async listComments(
    userId: string,
    partnerId: string | null,
    postId: string,
    cursor: string | null,
    limit: number,
  ): Promise<PostCommentPageDto> {
    const doc = await this.mustFindVisiblePost(userId, partnerId, postId);
    const take = Math.min(Math.max(limit, 1), POST_COMMENT_PAGE_SIZE);

    const mongo: Record<string, unknown> = {
      postId: doc._id,
      parentId: null,
      deletedAt: null,
    };
    if (cursor) {
      const parsed = parseCommentCursor(cursor);
      if (parsed) {
        mongo.$or = [
          { createdAt: { $gt: parsed.ts } },
          { createdAt: parsed.ts, _id: { $gt: parsed.id } },
        ];
      }
    }

    const rows = await this.postCommentModel
      .find(mongo)
      .sort({ createdAt: 1, _id: 1 })
      .limit(take + 1)
      .exec();

    const hasMore = rows.length > take;
    const primaries = hasMore ? rows.slice(0, take) : rows;

    let replies: PostCommentDocument[] = [];
    if (primaries.length > 0) {
      replies = await this.postCommentModel
        .find({
          parentId: { $in: primaries.map((p) => p._id) },
          deletedAt: null,
        })
        .sort({ createdAt: 1, _id: 1 })
        .exec();
    }

    const allAuthorIds: Types.ObjectId[] = [];
    for (const c of [...primaries, ...replies]) {
      allAuthorIds.push(c.authorId);
    }
    const authorMap = await this.loadAuthorMap(allAuthorIds);

    const repliesByParent = new Map<string, PostCommentDocument[]>();
    for (const r of replies) {
      const key = String(r.parentId);
      const arr = repliesByParent.get(key);
      if (arr) arr.push(r);
      else repliesByParent.set(key, [r]);
    }

    const items: PostCommentDto[] = primaries.map((p) => {
      const rs = repliesByParent.get(String(p._id)) ?? [];
      const primaryDto = this.toPostCommentDto(
        p,
        authorMap,
        userId,
        rs.length > 0,
      );
      primaryDto.replies = rs.map((r) =>
        this.toPostCommentDto(r, authorMap, userId, /*locked*/ false),
      );
      return primaryDto;
    });

    const last = primaries[primaries.length - 1];
    const nextCursor =
      hasMore && last ? makeCommentCursor(last.createdAt, last._id) : null;
    return { items, nextCursor };
  }

  /**
   * Feed 分页。
   * - type='daily'：always 返回 me + partner（若有）的日常；
   * - type='report'：
   *   - filter='all'：me + partner；
   *   - filter='unread'：仅 partner 发给 me、readAt=null（没有 partner 则返回空）；
   *   - filter='mine'：仅 me 自己发的。
   */
  async list(
    userId: string,
    partnerId: string | null,
    query: ListPostsQueryDto,
  ): Promise<PostListDto> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const filter: ReportFilter = query.filter ?? 'all';

    const authorFilter = this.buildAuthorFilter(
      userId,
      partnerId,
      query.type,
      filter,
    );
    if (!authorFilter) {
      // 比如 report + unread 但没有 partner，直接空返
      return { items: [], nextCursor: null };
    }

    const mongo: Record<string, unknown> = {
      type: query.type,
      deletedAt: null,
      ...authorFilter,
    };
    if (query.type === 'report' && filter === 'unread') {
      mongo.readAt = null;
    }

    if (query.cursor) {
      const parsed = parseCursor(query.cursor);
      if (parsed) {
        mongo.$or = [
          { happenedAt: { $lt: parsed.ts } },
          { happenedAt: parsed.ts, _id: { $lt: parsed.id } },
        ];
      }
    }

    const rows = await this.postModel
      .find(mongo)
      .sort({ happenedAt: -1, _id: -1 })
      .limit(limit + 1)
      .exec();

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    const authorMap = await this.loadAuthorMap(items.map((p) => p.authorId));
    const evalMap = await this.loadEvaluationMap(items.map((p) => p._id));
    const commentBlock = await this.loadCommentBlockForPosts(
      items.map((p) => p._id),
      userId,
    );

    const dtoItems = items.map((p) =>
      this.toDto(
        p,
        authorMap,
        evalMap.get(String(p._id)) ?? null,
        {
          comments: commentBlock.get(String(p._id))?.comments ?? [],
          commentCount: commentBlock.get(String(p._id))?.commentCount ?? 0,
        },
        userId,
      ),
    );

    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last ? makeCursor(toDate(last.happenedAt), last._id) : null;

    return { items: dtoItems, nextCursor };
  }

  async remove(userId: string, postId: string): Promise<void> {
    const doc = await this.mustFindOwnPost(userId, postId);
    const kind = doc.type;
    const idStr = String(doc._id);
    doc.deletedAt = new Date();
    await doc.save();
    const ck = await this.coupleKeyForUser(userId);
    if (ck) {
      if (kind === 'daily') {
        this.coupleRealtime.emitDailyDeleted(ck, idStr);
      } else if (kind === 'report') {
        this.coupleRealtime.emitReportDeleted(ck, idStr);
      }
    }
  }

  /** 标记报备为已阅。仅 partner（非作者）可调；已阅不重复打点。 */
  async markRead(
    userId: string,
    partnerId: string | null,
    postId: string,
  ): Promise<Date> {
    const doc = await this.mustFindVisiblePost(userId, partnerId, postId);
    if (doc.type !== 'report') {
      throw new BadRequestException({
        message: '仅报备可以标记已阅',
        errorKey: ErrorKey.E_POST_TYPE_MISMATCH,
      });
    }
    if (String(doc.authorId) === userId) {
      throw new ForbiddenException({
        message: '不能标记自己发的报备',
        errorKey: ErrorKey.E_POST_FORBIDDEN,
      });
    }
    const wasUnread = !doc.readAt;
    if (wasUnread) {
      doc.readAt = new Date();
      await doc.save();
    }
    if (wasUnread) {
      const authorMap = await this.loadAuthorMap([doc.authorId]);
      const evaluation = await this.loadEvaluation(String(doc._id));
      const commentBlock = await this.loadCommentBlockForPosts(
        [doc._id],
        userId,
      );
      const postDto = this.toDto(
        doc,
        authorMap,
        evaluation,
        commentBlock.get(String(doc._id)) ?? {
          comments: [],
          commentCount: 0,
        },
        userId,
      );
      const ck = await this.coupleKeyForUser(userId);
      if (ck) {
        this.coupleRealtime.emitReportUpdated(ck, postDto);
      }
    }
    return doc.readAt!;
  }

  // ---------- helpers：给其他 Service 用 ----------

  /** 取 post 文档（不带 DTO 转换），供 EvaluationService 做权限判断。 */
  async findVisiblePostDoc(
    userId: string,
    partnerId: string | null,
    postId: string,
  ): Promise<PostDocument> {
    return this.mustFindVisiblePost(userId, partnerId, postId);
  }

  // ---------- private ----------

  private async coupleKeyForUser(userId: string): Promise<string | null> {
    const u = await this.userService.findById(userId);
    if (!u?.partnerId) return null;
    return makeCoupleKey(String(u._id), String(u.partnerId));
  }

  private validateTags(type: PostType, tags: string[]): void {
    for (const t of tags) {
      if (!t || t.length > TAG_NAME_MAX) {
        throw new BadRequestException({
          message: `tag 长度应为 1~${TAG_NAME_MAX}`,
          errorKey: ErrorKey.E_VALIDATION,
        });
      }
    }
    if (type === 'daily' && tags.length > DAILY_TAG_MAX_PER_POST) {
      throw new BadRequestException({
        message: `日常 tag 数量不得超过 ${DAILY_TAG_MAX_PER_POST}`,
        errorKey: ErrorKey.E_VALIDATION,
      });
    }
    if (type === 'report') {
      if (tags.length < REPORT_TAG_MIN) {
        throw new BadRequestException({
          message: `报备至少需要 ${REPORT_TAG_MIN} 个 tag`,
          errorKey: ErrorKey.E_VALIDATION,
        });
      }
      if (tags.length > REPORT_TAG_MAX) {
        throw new BadRequestException({
          message: `报备 tag 数量不得超过 ${REPORT_TAG_MAX}`,
          errorKey: ErrorKey.E_VALIDATION,
        });
      }
    }
  }

  private async ensureReportTagsAllowed(
    userId: string,
    type: PostType,
    tags: string[],
  ): Promise<void> {
    if (type !== 'report') return;
    await this.tagService.validateReportTags(userId, tags);
  }

  private buildAuthorFilter(
    userId: string,
    partnerId: string | null,
    type: PostType,
    filter: ReportFilter,
  ): Record<string, unknown> | null {
    const me = new Types.ObjectId(userId);
    const partner = partnerId ? new Types.ObjectId(partnerId) : null;

    if (type === 'report') {
      if (filter === 'unread') {
        if (!partner) return null;
        return { authorId: partner };
      }
      if (filter === 'mine') {
        return { authorId: me };
      }
    }

    // daily 或 report-all
    const ids: Types.ObjectId[] = partner ? [me, partner] : [me];
    return { authorId: { $in: ids } };
  }

  private async mustFindOwnPost(
    userId: string,
    postId: string,
  ): Promise<PostDocument> {
    if (!Types.ObjectId.isValid(postId)) {
      throw new NotFoundException({
        message: '内容不存在',
        errorKey: ErrorKey.E_POST_NOT_FOUND,
      });
    }
    const doc = await this.postModel.findById(postId).exec();
    if (!doc || doc.deletedAt) {
      throw new NotFoundException({
        message: '内容不存在',
        errorKey: ErrorKey.E_POST_NOT_FOUND,
      });
    }
    if (String(doc.authorId) !== userId) {
      throw new ForbiddenException({
        message: '只能操作自己发的内容',
        errorKey: ErrorKey.E_POST_FORBIDDEN,
      });
    }
    return doc;
  }

  private async mustFindVisiblePost(
    userId: string,
    partnerId: string | null,
    postId: string,
  ): Promise<PostDocument> {
    if (!Types.ObjectId.isValid(postId)) {
      throw new NotFoundException({
        message: '内容不存在',
        errorKey: ErrorKey.E_POST_NOT_FOUND,
      });
    }
    const doc = await this.postModel.findById(postId).exec();
    if (!doc || doc.deletedAt) {
      throw new NotFoundException({
        message: '内容不存在',
        errorKey: ErrorKey.E_POST_NOT_FOUND,
      });
    }
    const ownerId = String(doc.authorId);
    if (ownerId !== userId && ownerId !== partnerId) {
      throw new ForbiddenException({
        message: '无权查看',
        errorKey: ErrorKey.E_POST_FORBIDDEN,
      });
    }
    return doc;
  }

  private async loadAuthorMap(
    ids: Types.ObjectId[],
  ): Promise<Map<string, UserDocument>> {
    const uniq = Array.from(new Set(ids.map((i) => String(i))));
    const users = await this.userService.findManyBrief(uniq);
    return new Map(users.map((u) => [String(u._id), u]));
  }

  private async loadEvaluation(postId: string): Promise<EvaluationDto | null> {
    if (!Types.ObjectId.isValid(postId)) return null;
    const doc = await this.evaluationModel
      .findOne({ postId: new Types.ObjectId(postId) })
      .exec();
    if (!doc) return null;
    const authorMap = await this.loadAuthorMap([doc.authorId]);
    return this.toEvaluationDto(doc, authorMap);
  }

  private async loadEvaluationMap(
    postIds: Types.ObjectId[],
  ): Promise<Map<string, EvaluationDto>> {
    if (postIds.length === 0) return new Map();
    const docs = await this.evaluationModel
      .find({ postId: { $in: postIds } })
      .exec();
    const authorMap = await this.loadAuthorMap(docs.map((d) => d.authorId));
    return new Map(
      docs.map((d) => [String(d.postId), this.toEvaluationDto(d, authorMap)]),
    );
  }

  /**
   * 批量取每条 post 的：
   * - 「最早 POST_COMMENT_PREVIEW 条**一级**评论」作为卡片预览；
   * - 「未删评论总数（一级 + 回复）」作为 commentCount。
   *
   * 两件事在同一次 aggregate 里用 `$facet` 算完，减少往返。
   */
  private async loadCommentBlockForPosts(
    postIds: Types.ObjectId[],
    viewerId: string,
  ): Promise<
    Map<string, { comments: PostCommentDto[]; commentCount: number }>
  > {
    const out = new Map<
      string,
      { comments: PostCommentDto[]; commentCount: number }
    >();
    if (postIds.length === 0) return out;

    type PreviewRow = {
      _id: Types.ObjectId;
      authorId: Types.ObjectId;
      parentId: Types.ObjectId | null;
      text: string;
      createdAt: Date;
      editedAt: Date | null;
      postId: Types.ObjectId;
    };
    type CountRow = { _id: Types.ObjectId; count: number };

    // 一级预览：每个 post 取最早 POST_COMMENT_PREVIEW 条一级评论
    const previews = await this.postCommentModel
      .aggregate<PreviewRow>([
        {
          $match: {
            postId: { $in: postIds },
            deletedAt: null,
            parentId: null,
          },
        },
        { $sort: { postId: 1, createdAt: 1, _id: 1 } },
        {
          $group: {
            _id: '$postId',
            items: {
              $push: {
                _id: '$_id',
                authorId: '$authorId',
                parentId: '$parentId',
                text: '$text',
                createdAt: '$createdAt',
                editedAt: '$editedAt',
                postId: '$postId',
              },
            },
          },
        },
        {
          $project: {
            items: { $slice: ['$items', POST_COMMENT_PREVIEW] },
          },
        },
        { $unwind: '$items' },
        { $replaceRoot: { newRoot: '$items' } },
      ])
      .exec();

    // 总数：一级 + 回复一起算
    const counts = await this.postCommentModel
      .aggregate<CountRow>([
        { $match: { postId: { $in: postIds }, deletedAt: null } },
        { $group: { _id: '$postId', count: { $sum: 1 } } },
      ])
      .exec();

    const countMap = new Map<string, number>();
    for (const c of counts) countMap.set(String(c._id), c.count);

    const authorIds = previews.map((p) => p.authorId);
    const authorMap = await this.loadAuthorMap(authorIds);

    const grouped = new Map<string, PreviewRow[]>();
    for (const p of previews) {
      const k = String(p.postId);
      const arr = grouped.get(k);
      if (arr) arr.push(p);
      else grouped.set(k, [p]);
    }

    // 初始化所有 postId 条目（确保 count>0 但 preview 可能为空时也有总数可取）
    const postIdKeys = new Set<string>([...grouped.keys(), ...countMap.keys()]);
    for (const key of postIdKeys) {
      const rows = grouped.get(key) ?? [];
      const comments = rows.map((c) =>
        this.toPostCommentDtoFromParts(c, authorMap, viewerId, false),
      );
      out.set(key, {
        comments,
        commentCount: countMap.get(key) ?? 0,
      });
    }

    return out;
  }

  /** 某一级评论是否仍有未删回复。 */
  private async hasLiveReplies(parentId: Types.ObjectId): Promise<boolean> {
    const n = await this.postCommentModel
      .countDocuments({ parentId, deletedAt: null })
      .limit(1)
      .exec();
    return n > 0;
  }

  private async mustFindVisibleComment(
    userId: string,
    partnerId: string | null,
    postId: string,
    commentId: string,
  ): Promise<{ postDoc: PostDocument; comment: PostCommentDocument }> {
    const postDoc = await this.mustFindVisiblePost(userId, partnerId, postId);
    if (postDoc.type !== 'daily') {
      throw new BadRequestException({
        message: '报备不支持评论',
        errorKey: ErrorKey.E_POST_TYPE_MISMATCH,
      });
    }
    if (!Types.ObjectId.isValid(commentId)) {
      throw new NotFoundException({
        message: '评论不存在',
        errorKey: ErrorKey.E_POST_COMMENT_NOT_FOUND,
      });
    }
    const comment = await this.postCommentModel.findById(commentId).exec();
    if (
      !comment ||
      comment.deletedAt ||
      String(comment.postId) !== String(postDoc._id)
    ) {
      throw new NotFoundException({
        message: '评论不存在',
        errorKey: ErrorKey.E_POST_COMMENT_NOT_FOUND,
      });
    }
    return { postDoc, comment };
  }

  private toEvaluationDto(
    doc: EvaluationDocument,
    authorMap: Map<string, UserDocument>,
  ): EvaluationDto {
    return {
      id: String(doc._id),
      postId: String(doc.postId),
      authorId: String(doc.authorId),
      author: this.toAuthorDto(
        authorMap.get(String(doc.authorId)),
        doc.authorId,
      ),
      text: doc.text,
      createdAt: toIsoString(doc.createdAt),
      updatedAt: toIsoString(doc.updatedAt),
    };
  }

  /**
   * 把单条评论文档转成 DTO。
   * - `viewerId`：调用方用户 id；预览场景可传空字符串，此时 canEdit/canDelete 恒 false。
   * - `locked`：该条评论是否处于「一级被回复锁定」状态（一级且有未删回复）。
   *   对回复或无回复的一级评论传 false。
   */
  private toPostCommentDto(
    c: PostCommentDocument,
    authorMap: Map<string, UserDocument>,
    viewerId: string,
    locked: boolean,
  ): PostCommentDto {
    return this.toPostCommentDtoFromParts(
      {
        _id: c._id,
        authorId: c.authorId,
        parentId: c.parentId ?? null,
        text: c.text,
        createdAt: c.createdAt,
        editedAt: c.editedAt ?? null,
      },
      authorMap,
      viewerId,
      locked,
    );
  }

  private toPostCommentDtoFromParts(
    c: {
      _id: Types.ObjectId;
      authorId: Types.ObjectId;
      parentId: Types.ObjectId | null;
      text: string;
      createdAt: Date;
      editedAt: Date | null;
    },
    authorMap: Map<string, UserDocument>,
    viewerId: string,
    locked: boolean,
  ): PostCommentDto {
    const author = authorMap.get(String(c.authorId));
    const mine = !!viewerId && String(c.authorId) === viewerId;
    // 预览用（viewerId 空或无意义）直接降权，避免卡片误拿到操作权限
    const canEdit = mine;
    const canDelete = mine && !(c.parentId === null && locked);
    return {
      id: String(c._id),
      author: this.toAuthorDto(author, c.authorId),
      text: c.text,
      parentId: c.parentId ? String(c.parentId) : null,
      createdAt: toIsoString(c.createdAt),
      editedAt: c.editedAt ? toIsoString(c.editedAt) : null,
      canEdit,
      canDelete,
    };
  }

  private toAuthorDto(
    author: UserDocument | undefined,
    fallbackId: Types.ObjectId,
  ): PostAuthorDto {
    return author
      ? {
          id: String(author._id),
          username: author.username,
          nickname: author.nickname,
          avatar: author.avatar,
        }
      : {
          id: String(fallbackId),
          username: '',
          nickname: '(未知用户)',
          avatar: '',
        };
  }

  private toDto(
    p: PostDocument,
    authorMap: Map<string, UserDocument>,
    evaluation: EvaluationDto | null,
    commentBlock: { comments: PostCommentDto[]; commentCount: number },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _viewerId: string,
  ): PostDto {
    const author = authorMap.get(String(p.authorId));
    return {
      id: String(p._id),
      type: p.type,
      author: this.toAuthorDto(author, p.authorId),
      text: p.text,
      images: p.images,
      tags: p.tags,
      happenedAt: toIsoString(p.happenedAt),
      createdAt: toIsoString(p.createdAt),
      updatedAt: toIsoString(p.updatedAt),
      readAt: p.readAt ? toIsoString(p.readAt) : null,
      evaluation,
      comments: commentBlock.comments,
      commentCount: commentBlock.commentCount,
    };
  }
}

// ---------- tag helpers ----------

/** 去空白 / 去空 / 去重（保持首次出现顺序）。 */
function dedupeTags(tags: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of tags) {
    const t = (raw ?? '').trim();
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

// ---------- cursor helpers ----------

function makeCursor(happenedAt: Date, id: Types.ObjectId): string {
  return `${happenedAt.getTime()}_${id.toHexString()}`;
}

function parseCursor(raw: string): { ts: Date; id: Types.ObjectId } | null {
  const m = /^(\d+)_([a-fA-F0-9]{24})$/.exec(raw);
  if (!m) return null;
  return { ts: new Date(Number(m[1])), id: new Types.ObjectId(m[2]) };
}

/** 评论分页按 createdAt 升序，用同样的 `${ms}_${hex}` 格式即可复用 */
function makeCommentCursor(createdAt: Date, id: Types.ObjectId): string {
  return `${createdAt.getTime()}_${id.toHexString()}`;
}

function parseCommentCursor(
  raw: string,
): { ts: Date; id: Types.ObjectId } | null {
  return parseCursor(raw);
}
