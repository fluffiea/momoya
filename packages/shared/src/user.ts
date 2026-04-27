import type { ReportFilter } from './post';

/** 见证页默认展示的子模块。用户偏好设置，落在 `User.settings` 里。 */
export type WitnessDefaultTab = 'daily' | 'report';

/** 可选值常量，UI 生成 segmented 时使用，避免魔法字符串。 */
export const WITNESS_DEFAULT_TAB_OPTIONS: ReadonlyArray<{
  value: WitnessDefaultTab;
  label: string;
}> = [
  { value: 'daily', label: '日常' },
  { value: 'report', label: '报备' },
];

/** 用户级偏好设置。之后有更多开关也加在这里。 */
export interface UserSettingsDto {
  /** 见证页首次进入时默认落在哪个子 tab；缺省见包内 `DEFAULT_WITNESS_TAB` */
  defaultWitnessTab: WitnessDefaultTab;
  /**
   * 见证页报备列表的默认筛选（待阅读 / 全部 / 我的）。
   * 缺省见包内 `DEFAULT_REPORT_LIST_FILTER`（`witness-defaults`）。
   */
  defaultReportListFilter: ReportFilter;
}

/** 当前登录用户的基本信息，`GET /auth/me`、`PATCH /users/me` 都返回这个结构。 */
export interface MeDto {
  /** 用户 ObjectId 字符串 */
  id: string;
  username: string;
  nickname: string;
  /** 头像；空串表示使用前端默认占位，否则为 /static/... 相对路径或完整 URL */
  avatar: string;
  bio: string;
  /** 绑定伴侣的用户 id，未绑定为 null */
  partnerId: string | null;
  /** 偏好设置；老账号兜底由后端补齐默认值 */
  settings: UserSettingsDto;
}

/** Partner 的简要公开信息，用于时间轴顶部的「双人关系卡片」。 */
export interface PartnerBriefDto {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  /** 账号创建时间，用于计算「在一起多少天」 */
  createdAt: string;
}

/** PATCH /users/me 请求体，字段均可选。 */
export interface UpdateMeInput {
  nickname?: string;
  bio?: string;
  avatar?: string;
  /** 偏好设置部分字段更新；后端做 partial merge。 */
  settings?: Partial<UserSettingsDto>;
}
