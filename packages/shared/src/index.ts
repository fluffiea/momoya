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
  /** 首次创建者；旧数据可能仅有 updatedByUsername */
  createdByUsername?: string;
  updatedByUsername?: string;
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
