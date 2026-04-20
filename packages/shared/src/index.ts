/** 前后端共享 DTO（与 API 契约一致） */

export interface DailyTag {
  id: string;
  label: string;
}

/**
 * 日常/报备统一记录的类型：
 * - `daily`：双方都可写的小日常时间线，允许互相评论（支持回复）
 * - `report`：单向报备（报告方 → 另一半），只允许对方写单条「评价」，并可一次性「已阅」
 */
export type DailyEntryKind = 'daily' | 'report';

/** 报备专用：谁在何时「已阅」 */
export interface DailyAck {
  username: string;
  /** ISO 时间 */
  at: string;
}

/**
 * 报备专用：对方对这条报备的单条文本评价。
 * 每条 entry 每个用户至多一条；字段预留扩展（后续可加 emoji 反应、评分等，不影响现有契约）。
 */
export interface ReportReview {
  id: string;
  entryId: string;
  username: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyEntry {
  id: string;
  at: string;
  body: string;
  tags: DailyTag[];
  /** 图片静态 URL 数组（最多 9 张） */
  images?: string[];
  /** 首次创建者；旧数据可能仅有 updatedByUsername */
  createdByUsername?: string;
  updatedByUsername?: string;
  /** 记录类型；旧数据默认为 'daily' */
  kind: DailyEntryKind;
  /** 仅报备：已阅回执列表（通常 0 或 1 条） */
  acks?: DailyAck[];
  /** 仅报备：对方的单条评价；详情接口返回，可能为 null */
  review?: ReportReview | null;
}

export interface DailyComment {
  id: string;
  entryId: string;
  /** 顶级评论无此字段；回复时为父评论 id */
  parentId?: string;
  body: string;
  username: string;
  createdAt: string;
}

export interface UserProfile {
  displayName: string;
  bio: string;
  /** 站点根相对路径（如 `/api/static/avatars/...`）或空字符串 */
  avatarUrl: string;
  /** 日常 Tab 默认展示「日常」还是「报备」，默认 'daily' */
  dailyDefaultView: DailyEntryKind;
  /**
   * 用户级自定义报备 tag 库（按用户持久化）。
   * 展示时 UI 会在前面拼接内置的「干饭」，这里只存用户自己加的短语。
   */
  reportTags: DailyTag[];
}

export interface UserPublic {
  id: string;
  username: string;
  profile: UserProfile;
}

/** 首页「我们俩」条带：左 jiangjiang、右 mengmeng（公开只读，不含 bio） */
export interface HomePartnerCard {
  username: string;
  displayName: string;
  avatarUrl: string;
}

export interface HomePartnersResponse {
  partners: [HomePartnerCard, HomePartnerCard];
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: UserPublic;
}

export interface PatchProfileRequest {
  displayName?: string;
  bio?: string;
  dailyDefaultView?: DailyEntryKind;
  /** 整组覆盖：发什么就保存什么（前端在加/删时计算新列表再发送） */
  reportTags?: DailyTag[];
}

/** 日常列表的游标分页响应 */
export interface DailyEntriesPage {
  entries: DailyEntry[];
  /** 下一页游标；null 表示已经到底 */
  nextCursor: string | null;
}

export interface CreateDailyEntryRequest {
  at: string;
  body: string;
  tags: DailyTag[];
  /** 省略时默认 'daily'（向后兼容） */
  kind?: DailyEntryKind;
}

export interface UpdateDailyEntryRequest {
  at?: string;
  body?: string;
  tags?: DailyTag[];
}

export interface CreateDailyCommentRequest {
  body: string;
  /** 回复时填父评论 id */
  parentId?: string;
}

export interface UpdateDailyCommentRequest {
  body: string;
}

/** 报备：创建/更新单条评价 */
export interface UpsertReportReviewRequest {
  body: string;
}
