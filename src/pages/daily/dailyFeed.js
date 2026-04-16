import { ANNIVERSARY } from '@/pages/home/link-us/constants';

/**
 * 日常动态：当前为静态 mock，日后可整体替换为接口返回（形状保持一致即可）。
 * `at` 与首页「在一起」起算时刻共用 constants.ANNIVERSARY。
 *
 * 预期 API 示例：GET /api/daily/entries → DailyEntry[]
 */

/**
 * @typedef {{ id: string, label: string }} DailyTag
 */

/**
 * @typedef {{
 *   id: string,
 *   at: string,
 *   body: string,
 *   tags: DailyTag[],
 * }} DailyEntry
 */

/** @type {DailyEntry[]} */
export const dailyEntriesMock = [
  {
    id: 'together',
    at: ANNIVERSARY.toISOString(),
    body:
      '从这一刻起，「喜欢」有了确切的时间：冬天里很普通的一个晚上，因为彼此点头，变成了我们的起点。以后日历上的每一天，都算在「一起」里。',
    tags: [
      { id: 'together', label: '我们在一起' },
      { id: 'start', label: '起点' },
    ],
  },
];

/** 新在前 */
export function sortDailyEntriesDesc(entries) {
  return [...entries].sort((a, b) => new Date(b.at) - new Date(a.at));
}
