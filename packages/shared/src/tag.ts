/**
 * 报备 Tag。
 *
 * - preset：系统内置（见 `PRESET_REPORT_TAGS`），不可删，所有人共享；
 * - custom：用户自建，仅本人可见 / 可用 / 可删；单用户数量受 USER_TAG_PER_USER_LIMIT 限制；
 *
 * 日常 post 的 tag 不走这里，而是发布时自由输入。
 */

export type TagSource = 'preset' | 'custom';

export interface TagDto {
  name: string;
  source: TagSource;
  /** custom tag 的创建时间；preset 固定返回空串，便于前端忽略 */
  createdAt: string;
}

export interface TagListDto {
  items: TagDto[];
}

export interface CreateTagInputDto {
  name: string;
}

export interface TagActionResultDto {
  ok: true;
}
