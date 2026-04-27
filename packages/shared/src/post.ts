/**
 * Post 统一实体：日常（daily）与报备（report）共用一张表。
 *
 * - `type='daily'`：朋友圈式日常。`tags` 为自由输入、不与用户绑定。
 * - `type='report'`：向 partner 的日程报备。`tags` 必须 >=1，且来自 preset ∪ 本人 user_tags。
 *   `readAt` 由 partner 在详情页点"已阅"后打点；作者本人点无效。
 *
 * 评价（evaluation）作为独立实体存储在 `evaluations` 集合，详情接口里内联返回。
 */

import type { EvaluationDto } from './evaluation';

export type PostType = 'daily' | 'report';

/**
 * 单条评论（或回复）。
 *
 * 层级规则（两层硬约束，仅用于 daily）：
 * - `parentId=null` → 一级评论；
 * - `parentId=<某一级评论 id>` → 二级回复；回复不能再嵌回复。
 *
 * 编辑 / 删除（详情页交互）：
 * - 一级评论：作者可改可删；**一旦其下出现任一未删回复，则变成「可改不可删」**；
 *   编辑过的评论客户端展示「已编辑」角标（由 `editedAt` 驱动）。
 * - 回复：回复作者随时可改可删；编辑同样会打 `editedAt`。
 * - 服务端会在每条返回中直接算好 `canEdit` / `canDelete`，前端直接用即可，不要重复推导。
 */
export interface PostCommentDto {
  id: string;
  author: PostAuthorDto;
  /** 评论正文，已做 trim；长度受 POST_COMMENT_MAX 约束。 */
  text: string;
  /** 父评论 id；null 为一级评论，非 null 为二级回复。 */
  parentId: string | null;
  /** ISO 字符串，评论创建时间。 */
  createdAt: string;
  /** 最近一次编辑时间；未编辑过为 null。 */
  editedAt: string | null;

  /**
   * 当前调用方对这条评论的权限（服务端已算好）。列表预览接口里这两个字段可能为
   * `false`（预览不承载操作入口），详情接口里才是权威值。
   */
  canEdit: boolean;
  canDelete: boolean;

  /**
   * 仅一级评论（`parentId=null`）在「详情页评论列表接口」里会带上此字段，
   * 值为该评论下所有未删回复，按 `createdAt` 升序、一次性全部返回。
   * 列表预览接口不带该字段。
   */
  replies?: PostCommentDto[];
}

/** 详情页评论列表的分页响应。 */
export interface PostCommentPageDto {
  /** 一级评论，按 createdAt 升序 */
  items: PostCommentDto[];
  /** 下一页 cursor；null 表示已到底 */
  nextCursor: string | null;
}

export type ReportFilter = 'all' | 'unread' | 'mine';

export interface PostAuthorDto {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
}

export interface PostDto {
  id: string;
  type: PostType;
  author: PostAuthorDto;

  /** 0~POST_TEXT_MAX 字 */
  text: string;
  /** 0~POST_IMAGE_MAX 张，元素为 /static/... 或 http(s):// */
  images: string[];
  /** 日常：自由输入；报备：来自 preset + user_tags */
  tags: string[];

  /** ISO 字符串，事件实际发生时间（默认 = createdAt） */
  happenedAt: string;
  /** ISO 字符串，作者发布时间 */
  createdAt: string;
  /** ISO 字符串，最后修改时间 */
  updatedAt: string;

  /** 仅 type='report' 有意义：partner 标记已阅的时间；null 表示未阅。daily 恒为 null。 */
  readAt: string | null;

  /** 详情返回时内联的评价（列表场景也返回，用于"评价数"或直接展示）。 */
  evaluation: EvaluationDto | null;

  /**
   * 列表/详情场景下内联的评论预览（按 createdAt 升序的最早 POST_COMMENT_PREVIEW 条一级评论）。
   * 此字段只给卡片做「文字预览」用：
   * - 不承载任何操作入口；
   * - 不包含回复（`replies` 不下发）；
   * - 不要用它渲染详情页评论列表——详情页请走 GET /posts/:id/comments。
   */
  comments?: PostCommentDto[];
  /**
   * 未删除评论总数（一级评论 + 所有回复，都计入）。
   * 卡片展示「N 条评论」时使用。
   */
  commentCount?: number;
}

export interface CreatePostInputDto {
  type: PostType;
  text?: string;
  images?: string[];
  tags?: string[];
  /** ISO 字符串；不传则服务端以 createdAt 填充 */
  happenedAt?: string;
}

export interface UpdatePostInputDto {
  text?: string;
  images?: string[];
  tags?: string[];
  happenedAt?: string;
}

export interface PostListDto {
  items: PostDto[];
  /** 下一页 cursor；null 表示已到底 */
  nextCursor: string | null;
}

export interface ListPostsQueryDto {
  type: PostType;
  /** 仅 type='report' 有意义，其它类型忽略；默认 'all' */
  filter?: ReportFilter;
  cursor?: string;
  limit?: number;
}

export interface PostActionResultDto {
  ok: true;
}

export interface MarkReadResultDto {
  readAt: string;
}

/** POST /posts/:id/comments 请求体 */
export interface CreatePostCommentInputDto {
  text: string;
  /** 回复哪条一级评论；空/未传即发一条一级评论。 */
  parentId?: string | null;
}

/** PATCH /posts/:id/comments/:commentId 请求体 */
export interface UpdatePostCommentInputDto {
  text: string;
}
