import type {
  ChangePasswordInputDto,
  ChangePasswordResultDto,
  LoginInputDto,
  LoginResultDto,
  LogoutResultDto,
  MeDto,
} from '@momoya/shared'
import { api } from './request'

export const authApi = {
  login: (input: LoginInputDto) =>
    api.post<LoginResultDto>('/auth/login', input, { skipAuth: true }),

  getMe: () => api.get<MeDto>('/auth/me'),

  changePassword: (input: ChangePasswordInputDto) =>
    api.post<ChangePasswordResultDto>('/auth/change-password', input),

  logout: () => api.post<LogoutResultDto>('/auth/logout'),
}
