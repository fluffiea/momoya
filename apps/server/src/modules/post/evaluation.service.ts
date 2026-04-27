import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { EvaluationDto } from '@momoya/shared';
import { makeCoupleKey } from '../../common/couple-key';
import { ErrorKey } from '../../common/constants/error-keys';
import { toIsoString } from '../../common/utils/date';
import { CoupleRealtimeService } from '../realtime/couple-realtime.service';
import { UserService } from '../user/user.service';
import { PostService } from './post.service';
import { Evaluation, EvaluationDocument } from './schemas/evaluation.schema';

@Injectable()
export class EvaluationService {
  constructor(
    @InjectModel(Evaluation.name)
    private readonly evaluationModel: Model<EvaluationDocument>,
    private readonly postService: PostService,
    private readonly userService: UserService,
    private readonly coupleRealtime: CoupleRealtimeService,
  ) {}

  /**
   * UPSERT 评价。
   *
   * 权限：
   * - 调用方必须是 post 作者的 partner（即 "TA 发给我的我才能评价"）；
   * - post 作者本人不能评价自己；
   * - partner 未绑定时直接拒；
   * 不可删除，但可反复修改。
   */
  async upsert(
    userId: string,
    partnerId: string | null,
    postId: string,
    text: string,
  ): Promise<EvaluationDto> {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new BadRequestException({
        message: '评价内容不能为空',
        errorKey: ErrorKey.E_VALIDATION,
      });
    }
    if (!partnerId) {
      throw new ForbiddenException({
        message: '未绑定 partner，无法评价',
        errorKey: ErrorKey.E_EVAL_NO_PARTNER,
      });
    }

    const postDoc = await this.postService.findVisiblePostDoc(
      userId,
      partnerId,
      postId,
    );
    if (String(postDoc.authorId) === userId) {
      throw new ForbiddenException({
        message: '不能评价自己发的内容',
        errorKey: ErrorKey.E_EVAL_ONLY_PARTNER,
      });
    }
    if (String(postDoc.authorId) !== partnerId) {
      // 这种情况不应该发生（visible + 不是自己 ⇒ 必然是 partner），兜底防御
      throw new ForbiddenException({
        message: '仅能评价 partner 发布的内容',
        errorKey: ErrorKey.E_EVAL_ONLY_PARTNER,
      });
    }

    const pid = new Types.ObjectId(postId);
    const uid = new Types.ObjectId(userId);

    const doc = await this.evaluationModel
      .findOneAndUpdate(
        { postId: pid },
        { $set: { text: trimmed, authorId: uid } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();

    const authors = await this.userService.findManyBrief([doc.authorId]);
    const u = authors[0];
    const author = u
      ? {
          id: String(u._id),
          username: u.username,
          nickname: u.nickname,
          avatar: u.avatar,
        }
      : {
          id: String(doc.authorId),
          username: '',
          nickname: '(未知用户)',
          avatar: '',
        };

    const dto: EvaluationDto = {
      id: String(doc._id),
      postId: String(doc.postId),
      authorId: String(doc.authorId),
      author,
      text: doc.text,
      createdAt: toIsoString(doc.createdAt),
      updatedAt: toIsoString(doc.updatedAt),
    };

    // 评价更新影响 post 卡片上的评价区/已评指示，按 post 类型广播完整 PostDto；
    // viewerId 取作者方（partnerId），让作者端拿到的预览权限是对的；
    // 评价者本人详情页是当下拉到的最新 dto，不依赖 broadcast。
    try {
      const postDtoForAuthor = await this.postService.detail(
        partnerId,
        postId,
        userId,
      );
      const ck = makeCoupleKey(userId, partnerId);
      if (postDtoForAuthor.type === 'daily') {
        this.coupleRealtime.emitDailyUpdated(ck, postDtoForAuthor);
      } else if (postDtoForAuthor.type === 'report') {
        this.coupleRealtime.emitReportUpdated(ck, postDtoForAuthor);
      }
    } catch {
      // broadcast 失败不影响主流程：客户端 onShow / 下拉刷新会兜底
    }

    return dto;
  }
}
