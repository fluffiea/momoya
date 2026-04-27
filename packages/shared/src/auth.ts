import type { MeDto } from './user';

export interface TokenPairDto {
  /** access token，用于业务接口 Authorization: Bearer */
  accessToken: string;
  /** refresh token，用于调用 /auth/refresh 换取新的 access */
  refreshToken: string;
  /** access token 有效期（秒） */
  accessExpiresIn: number;
  /** refresh token 有效期（秒） */
  refreshExpiresIn: number;
}

export interface LoginResultDto extends TokenPairDto {
  user: MeDto;
}

export interface ChangePasswordResultDto extends TokenPairDto {
  ok: boolean;
}

export interface LogoutResultDto {
  ok: boolean;
}

export interface LoginInputDto {
  username: string;
  password: string;
}

export interface ChangePasswordInputDto {
  oldPassword: string;
  newPassword: string;
}

export interface RefreshInputDto {
  refreshToken: string;
}
