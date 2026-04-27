import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { POST_COMMENT_MAX } from '@momoya/shared';
import {
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePostCommentDto {
  @ApiProperty({
    example: '收到啦',
    description: `1~${POST_COMMENT_MAX} 字`,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(POST_COMMENT_MAX)
  text!: string;

  @ApiPropertyOptional({
    example: '65f2a1b3c4d5e6f7a8b9c0d1',
    description:
      '要回复的一级评论 id；为空则发一级评论。不允许指向回复（两层硬限制）。',
    nullable: true,
  })
  @IsOptional()
  @IsMongoId()
  parentId?: string;
}
