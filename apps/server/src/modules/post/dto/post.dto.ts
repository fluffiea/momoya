import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  EvaluationDto as EvaluationShape,
  MarkReadResultDto as MarkReadShape,
  PostActionResultDto as PostActionShape,
  PostAuthorDto as PostAuthorShape,
  PostCommentDto as PostCommentShape,
  PostDto as PostShape,
  PostListDto as PostListShape,
  PostType,
} from '@momoya/shared';
import { POST_TEXT_MAX } from '@momoya/shared';

export class PostAuthorDto implements PostAuthorShape {
  @ApiProperty({ example: '65f1c2e4a1b2c3d4e5f67890' })
  id!: string;

  @ApiProperty({ example: 'jiangjiang' })
  username!: string;

  @ApiProperty({ example: '匠匠' })
  nickname!: string;

  @ApiProperty({ example: '/static/2026/04/avatar.png' })
  avatar!: string;
}

/** 评论的 Swagger 表示；实际 service 返回形状以 shared PostCommentDto 为准。 */
export class PostCommentViewDto implements PostCommentShape {
  @ApiProperty({ example: '65fa7b3c4d5e6f7a8b9c0d1e' })
  id!: string;

  @ApiProperty({ type: PostAuthorDto })
  author!: PostAuthorDto;

  @ApiProperty({ example: '好耶' })
  text!: string;

  @ApiProperty({
    example: null,
    nullable: true,
    description: '父评论 id；null=一级评论；非 null=二级回复',
  })
  parentId!: string | null;

  @ApiProperty({ example: '2026-04-22T23:35:00.000Z' })
  createdAt!: string;

  @ApiProperty({
    example: null,
    nullable: true,
    description: '最近一次编辑时间；未编辑过为 null',
  })
  editedAt!: string | null;

  @ApiProperty({ example: true })
  canEdit!: boolean;

  @ApiProperty({ example: true })
  canDelete!: boolean;

  @ApiPropertyOptional({
    type: () => [PostCommentViewDto],
    description: '一级评论下的所有未删回复；仅详情列表接口返回',
  })
  replies?: PostCommentShape[];
}

export class PostCommentPageViewDto {
  @ApiProperty({ type: [PostCommentViewDto] })
  items!: PostCommentViewDto[];

  @ApiProperty({ example: null, nullable: true })
  nextCursor!: string | null;
}

export class EvaluationViewDto implements EvaluationShape {
  @ApiProperty({ example: '65fa7b3c4d5e6f7a8b9c0d1e' })
  id!: string;

  @ApiProperty({ example: '65f2a1b3c4d5e6f7a8b9c0d1' })
  postId!: string;

  @ApiProperty({ example: '65f1c2e4a1b2c3d4e5f67890' })
  authorId!: string;

  @ApiProperty({ type: PostAuthorDto })
  author!: PostAuthorDto;

  @ApiProperty({ example: '真乖，记得按时休息。' })
  text!: string;

  @ApiProperty({ example: '2026-04-22T23:35:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-04-22T23:40:00.000Z' })
  updatedAt!: string;
}

export class PostDto implements PostShape {
  @ApiProperty({ example: '65f2a1b3c4d5e6f7a8b9c0d1' })
  id!: string;

  @ApiProperty({ enum: ['daily', 'report'], example: 'daily' })
  type!: PostType;

  @ApiProperty({ type: PostAuthorDto })
  author!: PostAuthorDto;

  @ApiProperty({
    example: '今天和 TA 去吃了日料',
    description: `0~${POST_TEXT_MAX} 字`,
  })
  text!: string;

  @ApiProperty({ type: [String], example: ['/static/2026/04/a.jpg'] })
  images!: string[];

  @ApiProperty({ type: [String], example: ['吃饭', '约会'] })
  tags!: string[];

  @ApiProperty({
    example: '2026-04-22T18:30:00.000Z',
    description: '事件实际发生时间（默认 = createdAt）',
  })
  happenedAt!: string;

  @ApiProperty({ example: '2026-04-22T23:30:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-04-22T23:35:00.000Z' })
  updatedAt!: string;

  @ApiProperty({
    nullable: true,
    example: null,
    description: '仅 type=report 时有意义；partner 标记已阅的时间',
  })
  readAt!: string | null;

  @ApiPropertyOptional({ type: EvaluationViewDto, nullable: true })
  evaluation!: EvaluationShape | null;

  @ApiPropertyOptional({
    type: [PostCommentViewDto],
    description: '按 createdAt 升序的最早几条评论（列表与详情均返回）',
  })
  comments?: PostCommentShape[];

  @ApiPropertyOptional({
    example: 2,
    description: '未删除评论总数',
  })
  commentCount?: number;
}

export class PostListDto implements PostListShape {
  @ApiProperty({ type: [PostDto] })
  items!: PostDto[];

  @ApiProperty({
    nullable: true,
    example: '1745423400000_65f2a1b3c4d5e6f7a8b9c0d1',
    description: '下一页 cursor；为 null 表示已到底',
  })
  nextCursor!: string | null;
}

export class PostActionResultDto implements PostActionShape {
  @ApiProperty({ example: true })
  ok!: true;
}

export class MarkReadResultDto implements MarkReadShape {
  @ApiProperty({ example: '2026-04-22T23:40:00.000Z' })
  readAt!: string;
}
