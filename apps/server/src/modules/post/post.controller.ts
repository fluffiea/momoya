import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post as HttpPost,
  Put,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ErrorKey } from '../../common/constants/error-keys';
import { ApiResponseOf } from '../../common/dto/api-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthUser } from '../auth/types/jwt-payload';
import { UserService } from '../user/user.service';
import { CreatePostCommentDto } from './dto/create-post-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { ListCommentsQueryDto } from './dto/list-comments.query.dto';
import { ListPostsQueryDto } from './dto/list-posts.query.dto';
import {
  EvaluationViewDto,
  MarkReadResultDto,
  PostActionResultDto,
  PostCommentPageViewDto,
  PostCommentViewDto,
  PostDto,
  PostListDto,
} from './dto/post.dto';
import { UpdatePostCommentDto } from './dto/update-post-comment.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { UpsertEvaluationDto } from './dto/upsert-evaluation.dto';
import { POST_COMMENT_PAGE_SIZE } from '@momoya/shared';
import { EvaluationService } from './evaluation.service';
import { PostService } from './post.service';

@ApiTags('日常 / 报备')
@Controller('posts')
@UseGuards(JwtAccessGuard)
@ApiBearerAuth('access-token')
export class PostController {
  constructor(
    private readonly postService: PostService,
    private readonly evaluationService: EvaluationService,
    private readonly userService: UserService,
  ) {}

  @HttpPost()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({
    summary: '发布一条 post（日常 / 报备）',
    description:
      'type=daily：text 与 images 至少一项非空；tags 自由输入，最多 10。' +
      'type=report：必须 1~10 个 tag，均须在 preset + 本人 user_tags 内。',
  })
  @ApiBody({ type: CreatePostDto })
  @ApiOkResponse({ type: ApiResponseOf(PostDto) })
  async create(
    @CurrentUser() auth: AuthUser,
    @Body() dto: CreatePostDto,
  ): Promise<PostDto> {
    const hasText = !!dto.text && dto.text.trim().length > 0;
    const hasImages = Array.isArray(dto.images) && dto.images.length > 0;
    if (!hasText && !hasImages) {
      throw new BadRequestException({
        message: 'text 与 images 不能同时为空',
        errorKey: ErrorKey.E_VALIDATION,
      });
    }
    return this.postService.create(auth.userId, dto);
  }

  @Get()
  @ApiOperation({
    summary: '分页列表',
    description:
      'type=daily：按 happenedAt 倒序返回 me + partner 的日常；' +
      'type=report：filter=all|unread|mine，unread 仅看 partner 未阅的报备。',
  })
  @ApiOkResponse({ type: ApiResponseOf(PostListDto) })
  async list(
    @CurrentUser() auth: AuthUser,
    @Query() query: ListPostsQueryDto,
  ): Promise<PostListDto> {
    const me = await this.userService.findById(auth.userId);
    if (!me) {
      throw new UnauthorizedException({
        message: '用户不存在',
        errorKey: ErrorKey.E_AUTH_INVALID,
      });
    }
    const partnerId = me.partnerId ? String(me.partnerId) : null;
    return this.postService.list(auth.userId, partnerId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: '详情（含 evaluation 内联）' })
  @ApiParam({ name: 'id', example: '65f2a1b3c4d5e6f7a8b9c0d1' })
  @ApiOkResponse({ type: ApiResponseOf(PostDto) })
  async detail(
    @CurrentUser() auth: AuthUser,
    @Param('id') id: string,
  ): Promise<PostDto> {
    const me = await this.userService.findById(auth.userId);
    if (!me) {
      throw new UnauthorizedException({
        message: '用户不存在',
        errorKey: ErrorKey.E_AUTH_INVALID,
      });
    }
    const partnerId = me.partnerId ? String(me.partnerId) : null;
    return this.postService.detail(auth.userId, id, partnerId);
  }

  @HttpPost(':id/comments')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({
    summary: '发表评论 / 回复',
    description:
      '对双方可见的 daily post 发评论；正文 1~300 字。' +
      '传 parentId 即为对某一级评论发回复（回复的回复会被拒）。' +
      '报备不支持评论。',
  })
  @ApiParam({ name: 'id', example: '65f2a1b3c4d5e6f7a8b9c0d1' })
  @ApiBody({ type: CreatePostCommentDto })
  @ApiOkResponse({ type: ApiResponseOf(PostCommentViewDto) })
  async addComment(
    @CurrentUser() auth: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreatePostCommentDto,
  ): Promise<PostCommentViewDto> {
    const me = await this.userService.findById(auth.userId);
    if (!me) {
      throw new UnauthorizedException({
        message: '用户不存在',
        errorKey: ErrorKey.E_AUTH_INVALID,
      });
    }
    const partnerId = me.partnerId ? String(me.partnerId) : null;
    return this.postService.addComment(
      auth.userId,
      partnerId,
      id,
      dto.text,
      dto.parentId ?? null,
    );
  }

  @Get(':id/comments')
  @ApiOperation({
    summary: '详情页评论列表（游标分页）',
    description:
      `一级评论按 createdAt 升序分页，每页最多 ${POST_COMMENT_PAGE_SIZE} 条；` +
      '每条一级评论内联返回其全部未删回复。报备不会有评论。',
  })
  @ApiParam({ name: 'id', example: '65f2a1b3c4d5e6f7a8b9c0d1' })
  @ApiOkResponse({ type: ApiResponseOf(PostCommentPageViewDto) })
  async listComments(
    @CurrentUser() auth: AuthUser,
    @Param('id') id: string,
    @Query() query: ListCommentsQueryDto,
  ): Promise<PostCommentPageViewDto> {
    const me = await this.userService.findById(auth.userId);
    if (!me) {
      throw new UnauthorizedException({
        message: '用户不存在',
        errorKey: ErrorKey.E_AUTH_INVALID,
      });
    }
    const partnerId = me.partnerId ? String(me.partnerId) : null;
    return this.postService.listComments(
      auth.userId,
      partnerId,
      id,
      query.cursor ?? null,
      query.limit ?? POST_COMMENT_PAGE_SIZE,
    );
  }

  @Patch(':id/comments/:commentId')
  @ApiOperation({
    summary: '编辑评论（仅作者本人）',
    description: '一级评论即使有回复也可编辑；编辑后会带 editedAt 标记。',
  })
  @ApiParam({ name: 'id', example: '65f2a1b3c4d5e6f7a8b9c0d1' })
  @ApiParam({ name: 'commentId', example: '65fa7b3c4d5e6f7a8b9c0d1e' })
  @ApiBody({ type: UpdatePostCommentDto })
  @ApiOkResponse({ type: ApiResponseOf(PostCommentViewDto) })
  async updateComment(
    @CurrentUser() auth: AuthUser,
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Body() dto: UpdatePostCommentDto,
  ): Promise<PostCommentViewDto> {
    const me = await this.userService.findById(auth.userId);
    if (!me) {
      throw new UnauthorizedException({
        message: '用户不存在',
        errorKey: ErrorKey.E_AUTH_INVALID,
      });
    }
    const partnerId = me.partnerId ? String(me.partnerId) : null;
    return this.postService.editComment(
      auth.userId,
      partnerId,
      id,
      commentId,
      dto.text,
    );
  }

  @Delete(':id/comments/:commentId')
  @ApiOperation({
    summary: '删除评论（软删，仅作者本人）',
    description:
      '回复可随时删；一级评论仅在没有未删回复时可删，否则返回 E_POST_COMMENT_LOCKED。',
  })
  @ApiParam({ name: 'id', example: '65f2a1b3c4d5e6f7a8b9c0d1' })
  @ApiParam({ name: 'commentId', example: '65fa7b3c4d5e6f7a8b9c0d1e' })
  @ApiOkResponse({ type: ApiResponseOf(PostActionResultDto) })
  async removeComment(
    @CurrentUser() auth: AuthUser,
    @Param('id') id: string,
    @Param('commentId') commentId: string,
  ): Promise<PostActionResultDto> {
    const me = await this.userService.findById(auth.userId);
    if (!me) {
      throw new UnauthorizedException({
        message: '用户不存在',
        errorKey: ErrorKey.E_AUTH_INVALID,
      });
    }
    const partnerId = me.partnerId ? String(me.partnerId) : null;
    await this.postService.removeComment(auth.userId, partnerId, id, commentId);
    return { ok: true };
  }

  @Patch(':id')
  @ApiOperation({ summary: '编辑 post（仅作者）' })
  @ApiParam({ name: 'id', example: '65f2a1b3c4d5e6f7a8b9c0d1' })
  @ApiOkResponse({ type: ApiResponseOf(PostDto) })
  async update(
    @CurrentUser() auth: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
  ): Promise<PostDto> {
    return this.postService.update(auth.userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '软删 post（仅作者）' })
  @ApiParam({ name: 'id', example: '65f2a1b3c4d5e6f7a8b9c0d1' })
  @ApiOkResponse({ type: ApiResponseOf(PostActionResultDto) })
  async remove(
    @CurrentUser() auth: AuthUser,
    @Param('id') id: string,
  ): Promise<PostActionResultDto> {
    await this.postService.remove(auth.userId, id);
    return { ok: true };
  }

  @HttpPost(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '标记报备为已阅（仅 partner）',
    description: '仅 type=report 有意义；已阅不会重复打点。',
  })
  @ApiParam({ name: 'id', example: '65f2a1b3c4d5e6f7a8b9c0d1' })
  @ApiOkResponse({ type: ApiResponseOf(MarkReadResultDto) })
  async markRead(
    @CurrentUser() auth: AuthUser,
    @Param('id') id: string,
  ): Promise<MarkReadResultDto> {
    const me = await this.userService.findById(auth.userId);
    if (!me) {
      throw new UnauthorizedException({
        message: '用户不存在',
        errorKey: ErrorKey.E_AUTH_INVALID,
      });
    }
    const partnerId = me.partnerId ? String(me.partnerId) : null;
    const readAt = await this.postService.markRead(auth.userId, partnerId, id);
    return { readAt: readAt.toISOString() };
  }

  @Put(':id/evaluation')
  @ApiOperation({
    summary: 'UPSERT 评价（仅 partner，可修改不可删）',
    description: '一条 post 至多一条评价；再次调用覆盖文本。',
  })
  @ApiParam({ name: 'id', example: '65f2a1b3c4d5e6f7a8b9c0d1' })
  @ApiBody({ type: UpsertEvaluationDto })
  @ApiOkResponse({ type: ApiResponseOf(EvaluationViewDto) })
  async upsertEvaluation(
    @CurrentUser() auth: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpsertEvaluationDto,
  ): Promise<EvaluationViewDto> {
    const me = await this.userService.findById(auth.userId);
    if (!me) {
      throw new UnauthorizedException({
        message: '用户不存在',
        errorKey: ErrorKey.E_AUTH_INVALID,
      });
    }
    const partnerId = me.partnerId ? String(me.partnerId) : null;
    const ev = await this.evaluationService.upsert(
      auth.userId,
      partnerId,
      id,
      dto.text,
    );
    return ev;
  }
}
