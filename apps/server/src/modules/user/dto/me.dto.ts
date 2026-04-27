import { ApiProperty } from '@nestjs/swagger';
import type {
  MeDto as MeShape,
  ReportFilter,
  UserSettingsDto as UserSettingsShape,
  WitnessDefaultTab,
} from '@momoya/shared';

/**
 * 用户偏好设置（见证默认 tab、报备默认筛选等）。
 * 字段形状由 `@momoya/shared` 的 `UserSettingsDto` 约束。
 */
export class UserSettingsDto implements UserSettingsShape {
  @ApiProperty({
    enum: ['daily', 'report'],
    example: 'daily',
    description: '见证页首次进入时默认落在哪个子 tab',
  })
  defaultWitnessTab!: WitnessDefaultTab;

  @ApiProperty({
    enum: ['all', 'unread', 'mine'],
    example: 'unread',
    description: '见证页报备列表默认筛选',
  })
  defaultReportListFilter!: ReportFilter;
}

/**
 * 当前登录用户的基本信息，`GET /auth/me`、`PATCH /users/me` 都返回这个结构。
 * 字段形状由 `@momoya/shared` 的 `MeDto` 接口约束，保证前后端类型一致。
 */
export class MeDto implements MeShape {
  @ApiProperty({
    example: '65f1c2e4a1b2c3d4e5f67890',
    description: '用户 ObjectId 字符串',
  })
  id!: string;

  @ApiProperty({ example: 'jiangjiang' })
  username!: string;

  @ApiProperty({ example: '匠匠' })
  nickname!: string;

  @ApiProperty({
    example: '',
    description:
      '头像；空串表示使用前端默认占位，否则为 /static/... 相对路径或完整 URL',
  })
  avatar!: string;

  @ApiProperty({ example: '', description: '个性签名' })
  bio!: string;

  @ApiProperty({
    example: '65f1c2e4a1b2c3d4e5f6788a',
    nullable: true,
    description: '绑定伴侣的用户 id，未绑定为 null',
  })
  partnerId!: string | null;

  @ApiProperty({ type: UserSettingsDto, description: '用户偏好设置' })
  settings!: UserSettingsDto;
}
