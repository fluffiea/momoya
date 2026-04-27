import { ApiProperty } from '@nestjs/swagger';
import type { PartnerBriefDto as PartnerBriefShape } from '@momoya/shared';

/** Partner 的简要公开信息，用于时间轴顶部的「双人关系卡片」。 */
export class PartnerBriefDto implements PartnerBriefShape {
  @ApiProperty({ example: '65f1c2e4a1b2c3d4e5f67890' })
  id!: string;

  @ApiProperty({ example: 'mengmeng' })
  username!: string;

  @ApiProperty({ example: '萌萌' })
  nickname!: string;

  @ApiProperty({
    example: '',
    description: '空串表示使用前端默认占位，否则为 /static/... 或完整 URL',
  })
  avatar!: string;

  @ApiProperty({
    example: '2026-04-01T00:00:00.000Z',
    description: '账号创建时间，用于计算「在一起多少天」',
  })
  createdAt!: string;
}
