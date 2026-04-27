/**
 * 纪念日（朝夕页）。
 * 目前仅情侣共享一条「在一起」的 system 纪念日，但按集合建模，方便后续扩展。
 * 公历年年循环；距今/距下次天数由前端基于 `date` 字段计算，后端不存派生字段。
 */
export interface AnniversaryDto {
  id: string;
  /** 显示名字，如「在一起」「生日」 */
  name: string;
  /** ISO 日期时间（UTC）。「在一起」系统纪念日可含时分；其余纪念日仍为 UTC 日界线。 */
  date: string;
  /** 创建者 userId；系统纪念日为 null */
  createdBy: string | null;
  /** system 纪念日：不可删除、不可改名，只能改日期 */
  isSystem: boolean;
  /**
   * 最近一次修改纪念日的 `date` 的用户 id；从未手动改过日期则为 null。
   * 展示「最后修改人」时配合 `updatedAt`（system 行仅允许改 date，故 updatedAt 即上次改日期时间）。
   */
  lastDateEditedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnniversaryListDto {
  items: AnniversaryDto[];
}

/** POST /anniversaries 请求体 */
export interface CreateAnniversaryInputDto {
  name: string;
  date: string;
}

/** PATCH /anniversaries/:id 请求体，字段均可选 */
export interface UpdateAnniversaryInputDto {
  name?: string;
  date?: string;
}
