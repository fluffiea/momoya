import type { ErrorKeyType } from './errors';

/** 业务成功响应：code 恒为 0，data 为业务负载。后端 ResponseInterceptor 产出这一形状。 */
export interface ApiSuccessResponse<T> {
  code: 0;
  data: T;
  msg: string;
}

/** 业务失败响应：code 非零，data 为 null，errorKey 标记具体业务错误。 */
export interface ApiErrorResponse {
  code: number;
  data: null;
  msg: string;
  errorKey: ErrorKeyType;
}

/** 后端任意响应的联合类型，前端请求层 narrow 使用。 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
