/**
 * 用户头像域：展示 {@link UserAvatar}，按用户名解析 URL 用 {@link usePartnerAvatars}（同目录，高内聚）。
 * 业务侧只依赖本 barrel，不直接引用内部文件。
 */
export { UserAvatar, type UserAvatarProps, type UserAvatarSize } from './UserAvatar';
export { usePartnerAvatars } from './usePartnerAvatars';
