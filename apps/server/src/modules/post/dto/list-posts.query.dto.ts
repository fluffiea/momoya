import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import type {
  ListPostsQueryDto as ListPostsShape,
  PostType,
  ReportFilter,
} from '@momoya/shared';

/**
 * 列表 query：
 * - `type` 必填，分流日常 / 报备两种 feed；
 * - `filter` 仅对 report 生效：all / unread（收件箱）/ mine（我发的）；daily 忽略该字段；
 * - cursor 形如 `<happenedAtEpochMs>_<objectIdHex>`。
 */
export class ListPostsQueryDto implements ListPostsShape {
  @ApiProperty({ enum: ['daily', 'report'], example: 'daily' })
  @IsEnum(['daily', 'report'])
  type!: PostType;

  @ApiPropertyOptional({ enum: ['all', 'unread', 'mine'], default: 'all' })
  @IsOptional()
  @IsEnum(['all', 'unread', 'mine'])
  filter?: ReportFilter;

  @ApiPropertyOptional({
    description: '下一页游标',
    example: '1745423400000_65f2a1b3c4d5e6f7a8b9c0d1',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+_[a-fA-F0-9]{24}$/, {
    message: 'cursor 格式应为 <epochMs>_<objectId>',
  })
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
