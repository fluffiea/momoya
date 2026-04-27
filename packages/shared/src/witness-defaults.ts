import type { ReportFilter } from './post';
import type { WitnessDefaultTab } from './user';

/**
 * 产品默认：见证页首次进入时落在哪个子模块。
 * 用户可在「设置」中覆盖并持久化到 `User.settings.defaultWitnessTab`。
 */
export const DEFAULT_WITNESS_TAB: WitnessDefaultTab = 'report';

/**
 * 产品默认：报备列表的筛选（待阅读 / 全部 / 我的）。
 * 写入 `User.settings.defaultReportListFilter`，设置页可改；未持久化前客户端用此兜底。
 */
export const DEFAULT_REPORT_LIST_FILTER: ReportFilter = 'unread';

/** 设置页与 UI 共用的报备筛选选项 */
export const REPORT_LIST_FILTER_OPTIONS: ReadonlyArray<{
  value: ReportFilter;
  label: string;
}> = [
  { value: 'unread', label: '待阅读' },
  { value: 'all', label: '全部' },
  { value: 'mine', label: '我的' },
];
