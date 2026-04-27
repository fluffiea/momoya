import type {
  CreatePostCommentInputDto,
  CreatePostInputDto,
  EvaluationDto,
  ListPostsQueryDto,
  MarkReadResultDto,
  PostActionResultDto,
  PostCommentDto,
  PostCommentPageDto,
  PostDto,
  PostListDto,
  UpdatePostCommentInputDto,
  UpdatePostInputDto,
  UpsertEvaluationInputDto,
} from '@momoya/shared'
import { api } from './request'

function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const entries: string[] = []
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    entries.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  }
  return entries.length ? `?${entries.join('&')}` : ''
}

export const postApi = {
  list(query: ListPostsQueryDto) {
    const qs = buildQuery({
      type: query.type,
      filter: query.filter,
      cursor: query.cursor,
      limit: query.limit,
    })
    return api.get<PostListDto>(`/posts${qs}`)
  },
  detail(id: string) {
    return api.get<PostDto>(`/posts/${id}`)
  },
  create(input: CreatePostInputDto) {
    return api.post<PostDto>('/posts', input)
  },
  update(id: string, input: UpdatePostInputDto) {
    return api.patch<PostDto>(`/posts/${id}`, input)
  },
  remove(id: string) {
    return api.delete<PostActionResultDto>(`/posts/${id}`)
  },
  markRead(id: string) {
    return api.post<MarkReadResultDto>(`/posts/${id}/read`, {})
  },
  upsertEvaluation(id: string, input: UpsertEvaluationInputDto) {
    return api.put<EvaluationDto>(`/posts/${id}/evaluation`, input)
  },
  createComment(id: string, input: CreatePostCommentInputDto) {
    return api.post<PostCommentDto>(`/posts/${encodeURIComponent(id)}/comments`, input)
  },
  listComments(id: string, params: { cursor?: string | null; limit?: number } = {}) {
    const qs = buildQuery({ cursor: params.cursor ?? undefined, limit: params.limit })
    return api.get<PostCommentPageDto>(
      `/posts/${encodeURIComponent(id)}/comments${qs}`,
    )
  },
  updateComment(id: string, commentId: string, input: UpdatePostCommentInputDto) {
    return api.patch<PostCommentDto>(
      `/posts/${encodeURIComponent(id)}/comments/${encodeURIComponent(commentId)}`,
      input,
    )
  },
  deleteComment(id: string, commentId: string) {
    return api.delete<PostActionResultDto>(
      `/posts/${encodeURIComponent(id)}/comments/${encodeURIComponent(commentId)}`,
    )
  },
}
