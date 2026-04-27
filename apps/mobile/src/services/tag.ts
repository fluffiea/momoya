import type {
  CreateTagInputDto,
  TagActionResultDto,
  TagDto,
  TagListDto,
} from '@momoya/shared'
import { api } from './request'

export const tagApi = {
  list() {
    return api.get<TagListDto>('/tags')
  },
  create(input: CreateTagInputDto) {
    return api.post<TagDto>('/tags', input)
  },
  /** name 会被 encodeURIComponent 以兼容中文 tag。 */
  remove(name: string) {
    return api.delete<TagActionResultDto>(`/tags/${encodeURIComponent(name)}`)
  },
}
