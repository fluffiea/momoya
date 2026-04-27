/**
 * 业务错误码的唯一来源是 `@momoya/shared`，本文件只做 re-export 以避免前后端漂移。
 * 新增 / 修改 errorKey 时请直接修改 `packages/shared/src/errors.ts`。
 */
export {
  ErrorKey,
  ErrorCode,
  httpStatusToErrorKey,
  isSessionFatal,
} from '@momoya/shared';
export type { ErrorKeyType } from '@momoya/shared';
