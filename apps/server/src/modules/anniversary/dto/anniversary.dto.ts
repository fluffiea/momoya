import { ApiProperty } from '@nestjs/swagger';
import type {
  AnniversaryDto as AnniversaryShape,
  AnniversaryListDto as AnniversaryListShape,
} from '@momoya/shared';

export class AnniversaryDto implements AnniversaryShape {
  @ApiProperty({ example: '65f1c2e4a1b2c3d4e5f67890' })
  id!: string;

  @ApiProperty({ example: '在一起' })
  name!: string;

  @ApiProperty({
    example: '2024-05-20T00:00:00.000Z',
    description: 'ISO 日期（UTC 零点），前端自行按年年循环计算距今/距下次天数',
  })
  date!: string;

  @ApiProperty({
    example: null,
    nullable: true,
    description: '创建者 userId；system 纪念日为 null',
  })
  createdBy!: string | null;

  @ApiProperty({ example: true, description: '系统纪念日不可删、不可改名' })
  isSystem!: boolean;

  @ApiProperty({
    example: null,
    nullable: true,
    description: '最近一次 PATCH 修改 date 的用户 id；未改过则为 null',
  })
  lastDateEditedBy!: string | null;

  @ApiProperty({ example: '2024-05-20T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2024-05-20T00:00:00.000Z' })
  updatedAt!: string;
}

export class AnniversaryListDto implements AnniversaryListShape {
  @ApiProperty({ type: [AnniversaryDto] })
  items!: AnniversaryDto[];
}

export class AnniversaryActionResultDto {
  @ApiProperty({ example: true })
  ok!: true;
}
