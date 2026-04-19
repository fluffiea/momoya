/** 前后端共享 DTO（与 API 契约一致） */

export interface DailyTag {
  id: string;
  label: string;
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
