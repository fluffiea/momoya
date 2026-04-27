import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type {
  ReportFilter,
  UpdateMeInput,
  WitnessDefaultTab,
} from '@momoya/shared';
import {
  ASSET_URL_PATTERN,
  BIO_MAX,
  NICKNAME_MAX,
  NICKNAME_MIN,
} from '@momoya/shared';

/**
 * settings 子结构，全部字段可选，支持部分更新（`PATCH`-style）。
 */
export class UpdateMeSettingsDto {
  @ApiPropertyOptional({
    enum: ['daily', 'report'],
    example: 'daily',
    description: '见证页默认子 tab',
  })
  @IsOptional()
  @IsEnum(['daily', 'report'])
  defaultWitnessTab?: WitnessDefaultTab;

  @ApiPropertyOptional({
    enum: ['all', 'unread', 'mine'],
    example: 'unread',
    description: '见证页报备列表默认筛选',
  })
  @IsOptional()
  @IsEnum(['all', 'unread', 'mine'])
  defaultReportListFilter?: ReportFilter;
}

/**
 * PATCH /users/me 请求体。全部字段可选，但至少传一项才有意义
 * （ValidationPipe 的 whitelist 已拦截未知字段，空对象会被放行但 service 里会直接返回当前 me）。
 * 字段形状由 `@momoya/shared` 的 `UpdateMeInput` 约束。
 */
export class UpdateMeDto implements UpdateMeInput {
  @ApiPropertyOptional({
    example: '匠匠',
    minLength: NICKNAME_MIN,
    maxLength: NICKNAME_MAX,
    description: `昵称；${NICKNAME_MIN}-${NICKNAME_MAX} 字符，支持中英文数字`,
  })
  @IsOptional()
  @IsString()
  @MinLength(NICKNAME_MIN, { message: '昵称不能为空' })
  @MaxLength(NICKNAME_MAX, { message: `昵称最长 ${NICKNAME_MAX} 字符` })
  nickname?: string;

  @ApiPropertyOptional({
    example: '喜欢阳光和猫猫',
    maxLength: BIO_MAX,
    description: `个性签名；0-${BIO_MAX} 字符，允许空串`,
  })
  @IsOptional()
  @IsString()
  @MaxLength(BIO_MAX, { message: `签名最长 ${BIO_MAX} 字符` })
  bio?: string;

  @ApiPropertyOptional({
    example: '/static/2026/04/3f3b8b9a.webp',
    description:
      '头像 URL：必须是 `/static/` 开头的相对路径（来自 POST /upload/image），或 http(s)://… 完整 URL',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(ASSET_URL_PATTERN, {
    message: 'avatar 必须是 /static/ 相对路径或 http(s):// 完整 URL',
  })
  avatar?: string;

  @ApiPropertyOptional({
    type: UpdateMeSettingsDto,
    description: '偏好设置，部分字段可选；后端做 partial merge 不会覆盖未传字段',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateMeSettingsDto)
  settings?: UpdateMeSettingsDto;
}
