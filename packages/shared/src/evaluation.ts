/**
 * partner 对某条 post 的评价：每帖至多一条，只可修改不可删除。
 *
 * 写入规则：
 * - authorId 必须等于 post.author 的 partner（即：只能对"TA发给我的"评价）；
 * - post 作者本人写评价会被拒；
 * - 文本 1~EVALUATION_MAX 字；
 * - 无单独创建 / 删除接口，仅一个 PUT /posts/:id/evaluation 做 UPSERT。
 */

/** 与 PostAuthorDto 同形，供列表/详情展示「谁写的评价」 */
export interface EvaluationAuthorDto {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
}

export interface EvaluationDto {
  id: string;
  postId: string;
  authorId: string;
  /** 评价撰写者（通常为收到报备一方的 partner） */
  author: EvaluationAuthorDto;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertEvaluationInputDto {
  text: string;
}
