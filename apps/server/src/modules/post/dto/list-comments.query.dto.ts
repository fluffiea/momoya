import { ApiPropertyOptional } from '@nestjs/swagger';
import { POST_COMMENT_PAGE_SIZE } from '@momoya/shared';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListCommentsQueryDto {
  @ApiPropertyOptional({
    example: '1713700000000_65fa7b3c4d5e6f7a8b9c0d1e',
    description: '上一页返回的 nextCursor；首次可以不传',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    example: POST_COMMENT_PAGE_SIZE,
    description: `每页一级评论数，默认 ${POST_COMMENT_PAGE_SIZE}，上限同默认`,
    minimum: 1,
    maximum: POST_COMMENT_PAGE_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(POST_COMMENT_PAGE_SIZE)
  limit?: number;
}
