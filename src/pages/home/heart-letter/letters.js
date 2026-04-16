import heartIcon from './icons/heart.svg';
import badIcon from './icons/bad.svg';

/**
 * 心动信件列表：新增条目往数组追加即可；key 使用唯一 path。
 *
 * 示例（追加第三条，需配置好路由）：
 * {
 *   path: '/your-route',
 *   icon: heartIcon,
 *   title: '标题',
 *   subTitle: '副标题',
 *   tags: ['日期'],
 * },
 */
export const LETTERS = [
  {
    path: '/confess',
    icon: heartIcon,
    title: '恋爱申请书',
    subTitle: '前辈，请和我交往',
    tags: ['2025.12.27'],
  },
  {
    path: '/apology',
    icon: badIcon,
    title: '道歉信',
    subTitle: '洗衣粉，我知错了',
    tags: ['2026.02.20'],
  },
];
