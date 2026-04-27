/**
 * 前后端统一的业务错误枚举与内部业务错误码。
 * - `ErrorKey`：稳定字符串，前端据此决定跳转 / 文案。新增错误必须在这里加。
 * - `ErrorCode`：业务码，HTTP 层之上再细分（`40001` 等），与 HTTP status 组合使用。
 * - `httpStatusToErrorKey`：HTTP → 默认 ErrorKey 的兜底映射，后端 filter 在未显式指定 errorKey 时使用。
 */
export const ErrorKey = {
  E_VALIDATION: 'E_VALIDATION',
  E_AUTH_INVALID: 'E_AUTH_INVALID',
  E_AUTH_REQUIRED: 'E_AUTH_REQUIRED',
  E_AUTH_EXPIRED: 'E_AUTH_EXPIRED',
  E_SESSION_KICKED: 'E_SESSION_KICKED',
  E_AUTH_WRONG_OLD_PASSWORD: 'E_AUTH_WRONG_OLD_PASSWORD',
  E_FORBIDDEN: 'E_FORBIDDEN',
  E_NOT_FOUND: 'E_NOT_FOUND',
  E_CONFLICT: 'E_CONFLICT',
  E_UPLOAD_TYPE: 'E_UPLOAD_TYPE',
  E_UPLOAD_TOO_LARGE: 'E_UPLOAD_TOO_LARGE',
  E_UPLOAD_MISSING: 'E_UPLOAD_MISSING',
  E_POST_NOT_FOUND: 'E_POST_NOT_FOUND',
  E_POST_FORBIDDEN: 'E_POST_FORBIDDEN',
  E_POST_TYPE_MISMATCH: 'E_POST_TYPE_MISMATCH',
  E_POST_COMMENT_NOT_FOUND: 'E_POST_COMMENT_NOT_FOUND',
  E_POST_COMMENT_FORBIDDEN: 'E_POST_COMMENT_FORBIDDEN',
  /** 一级评论有回复后，尝试删除；此时仅允许编辑。 */
  E_POST_COMMENT_LOCKED: 'E_POST_COMMENT_LOCKED',
  /** 尝试在回复上再发回复（超出两层限制）。 */
  E_POST_COMMENT_DEPTH: 'E_POST_COMMENT_DEPTH',
  E_EVAL_ONLY_PARTNER: 'E_EVAL_ONLY_PARTNER',
  E_EVAL_NO_PARTNER: 'E_EVAL_NO_PARTNER',
  E_TAG_DUPLICATE: 'E_TAG_DUPLICATE',
  E_TAG_LIMIT: 'E_TAG_LIMIT',
  E_TAG_PRESET_READONLY: 'E_TAG_PRESET_READONLY',
  E_TAG_NOT_FOUND: 'E_TAG_NOT_FOUND',
  E_ANNIV_NOT_FOUND: 'E_ANNIV_NOT_FOUND',
  E_ANNIV_FORBIDDEN: 'E_ANNIV_FORBIDDEN',
  E_ANNIV_SYSTEM_READONLY: 'E_ANNIV_SYSTEM_READONLY',
  E_RATE_LIMIT: 'E_RATE_LIMIT',
  E_INTERNAL: 'E_INTERNAL',
} as const;

export type ErrorKeyType = (typeof ErrorKey)[keyof typeof ErrorKey];

export const ErrorCode: Record<ErrorKeyType, number> = {
  [ErrorKey.E_VALIDATION]: 40001,
  [ErrorKey.E_AUTH_INVALID]: 40101,
  [ErrorKey.E_AUTH_REQUIRED]: 40102,
  [ErrorKey.E_AUTH_EXPIRED]: 40103,
  [ErrorKey.E_SESSION_KICKED]: 40104,
  [ErrorKey.E_AUTH_WRONG_OLD_PASSWORD]: 40105,
  [ErrorKey.E_FORBIDDEN]: 40301,
  [ErrorKey.E_NOT_FOUND]: 40401,
  [ErrorKey.E_CONFLICT]: 40901,
  [ErrorKey.E_UPLOAD_TYPE]: 41501,
  [ErrorKey.E_UPLOAD_TOO_LARGE]: 41301,
  [ErrorKey.E_UPLOAD_MISSING]: 40002,
  [ErrorKey.E_POST_NOT_FOUND]: 40404,
  [ErrorKey.E_POST_FORBIDDEN]: 40304,
  [ErrorKey.E_POST_TYPE_MISMATCH]: 40005,
  [ErrorKey.E_POST_COMMENT_NOT_FOUND]: 40407,
  [ErrorKey.E_POST_COMMENT_FORBIDDEN]: 40309,
  [ErrorKey.E_POST_COMMENT_LOCKED]: 40907,
  [ErrorKey.E_POST_COMMENT_DEPTH]: 40007,
  [ErrorKey.E_EVAL_ONLY_PARTNER]: 40305,
  [ErrorKey.E_EVAL_NO_PARTNER]: 40902,
  [ErrorKey.E_TAG_DUPLICATE]: 40903,
  [ErrorKey.E_TAG_LIMIT]: 40006,
  [ErrorKey.E_TAG_PRESET_READONLY]: 40306,
  [ErrorKey.E_TAG_NOT_FOUND]: 40405,
  [ErrorKey.E_ANNIV_NOT_FOUND]: 40406,
  [ErrorKey.E_ANNIV_FORBIDDEN]: 40307,
  [ErrorKey.E_ANNIV_SYSTEM_READONLY]: 40308,
  [ErrorKey.E_RATE_LIMIT]: 42901,
  [ErrorKey.E_INTERNAL]: 50001,
};

export const httpStatusToErrorKey: Record<number, ErrorKeyType> = {
  400: ErrorKey.E_VALIDATION,
  401: ErrorKey.E_AUTH_REQUIRED,
  403: ErrorKey.E_FORBIDDEN,
  404: ErrorKey.E_NOT_FOUND,
  409: ErrorKey.E_CONFLICT,
  413: ErrorKey.E_UPLOAD_TOO_LARGE,
  415: ErrorKey.E_UPLOAD_TYPE,
  429: ErrorKey.E_RATE_LIMIT,
  500: ErrorKey.E_INTERNAL,
};

/** 是否表示会话不可恢复（必须重新登录）。前端请求拦截器据此决定是否 reLaunch 到登录页。 */
export function isSessionFatal(errorKey?: string | null): boolean {
  return (
    errorKey === ErrorKey.E_AUTH_INVALID ||
    errorKey === ErrorKey.E_AUTH_REQUIRED ||
    errorKey === ErrorKey.E_SESSION_KICKED
  );
}
