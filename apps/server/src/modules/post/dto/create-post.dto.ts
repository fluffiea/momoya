import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import type { CreatePostInputDto, PostType } from '@momoya/shared';
import {
  ASSET_URL_PATTERN,
  DAILY_TAG_MAX_PER_POST,
  POST_IMAGE_MAX,
  POST_TEXT_MAX,
  REPORT_TAG_MAX,
  TAG_NAME_MAX,
} from '@momoya/shared';

const POST_TAG_LIMIT = Math.max(DAILY_TAG_MAX_PER_POST, REPORT_TAG_MAX);

/**
 * 「text / images 不能同时为空」「报备 tags 至少 1 个」等跨字段规则
 * 由 Controller / Service 显式校验，避免 whitelist 模式误判。
 */
export class CreatePostDto implements CreatePostInputDto {
  @ApiProperty({ enum: ['daily', 'report'], example: 'daily' })
  @IsEnum(['daily', 'report'])
  type!: PostType;

  @ApiPropertyOptional({
    default: '',
    maxLength: POST_TEXT_MAX,
    example: '今天和 TA 去吃了日料',
  })
  @IsOptional()
  @IsString()
  @MaxLength(POST_TEXT_MAX)
  text?: string;

  @ApiPropertyOptional({
    type: [String],
    maxItems: POST_IMAGE_MAX,
    description: `图片列表，元素为 /static/... 或 http(s):// 完整 URL；最多 ${POST_IMAGE_MAX} 张`,
    example: ['/static/2026/04/a.jpg'],
  })
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

  @ApiPropertyOptional({
    type: [String],
    maxItems: POST_TAG_LIMIT,
    description: `tags；日常最多 ${DAILY_TAG_MAX_PER_POST}，报备 1~${REPORT_TAG_MAX}`,
    example: ['吃饭', '约会'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(POST_TAG_LIMIT)
  @IsString({ each: true })
  @MaxLength(TAG_NAME_MAX, { each: true })
  tags?: string[];

  @ApiPropertyOptional({
    example: '2026-04-22T18:30:00.000Z',
    description: '事件发生时间 ISO 字符串；省略则以服务端当前时间填',
  })
  @IsOptional()
  @IsISO8601()
  happenedAt?: string;
}
