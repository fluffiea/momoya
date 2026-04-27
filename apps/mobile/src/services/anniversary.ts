import type {
  AnniversaryDto,
  AnniversaryListDto,
  CreateAnniversaryInputDto,
  UpdateAnniversaryInputDto,
} from '@momoya/shared'
import { api } from './request'

export const anniversaryApi = {
  list: () => api.get<AnniversaryListDto>('/anniversaries'),
  create: (input: CreateAnniversaryInputDto) =>
    api.post<AnniversaryDto>('/anniversaries', input),
  update: (id: string, input: UpdateAnniversaryInputDto) =>
    api.patch<AnniversaryDto>(`/anniversaries/${id}`, input),
  remove: (id: string) =>
    api.delete<{ ok: true }>(`/anniversaries/${id}`),
}
