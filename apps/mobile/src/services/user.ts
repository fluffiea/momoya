import type { MeDto, PartnerBriefDto, UpdateMeInput } from '@momoya/shared'
import { api } from './request'

export const userApi = {
  updateMe: (input: UpdateMeInput) => api.patch<MeDto>('/users/me', input),
  /** 拿自己的 partner 简要信息（含 createdAt 用于算相恋天数）；未绑定 partner 返回 null。 */
  getPartner: () => api.get<PartnerBriefDto | null>('/users/partner'),
}
