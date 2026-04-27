import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import type { UpdatePostInputDto } from '@momoya/shared';
import {
  ASSET_URL_PATTERN,
  DAILY_TAG_MAX_PER_POST,
  POST_IMAGE_MAX,
  POST_TEXT_MAX,
  REPORT_TAG_MAX,
  TAG_NAME_MAX,
} from '@momoya/shared';

const POST_TAG_LIMIT = Math.max(DAILY_TAG_MAX_PER_POST, REPORT_TAG_MAX);

export class UpdatePostDto implements UpdatePostInputDto {
  @ApiPropertyOptional({ maxLength: POST_TEXT_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(POST_TEXT_MAX)
  text?: string;

  @ApiPropertyOptional({ type: [String], maxItems: POST_IMAGE_MAX })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(POST_IMAGE_MAX)
  @IsString({ each: true })
  @Matches(ASSET_URL_PATTERN, {
    each: true,
    message: 'images 每项必须是 /static/ 相对路径或 http(s):// URL',
  })
  @MaxLength(500, { each: true })
  images?: string[];

  @ApiPropertyOptional({ type: [String], maxItems: POST_TAG_LIMIT })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(POST_TAG_LIMIT)
  @IsString({ each: true })
  @MaxLength(TAG_NAME_MAX, { each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: '2026-04-22T18:30:00.000Z' })
  @IsOptional()
  @IsISO8601()
  happenedAt?: string;
}
