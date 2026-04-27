import { ApiProperty } from '@nestjs/swagger';
import type {
  TagActionResultDto as TagActionShape,
  TagDto as TagShape,
  TagListDto as TagListShape,
  TagSource,
} from '@momoya/shared';

export class TagDto implements TagShape {
  @ApiProperty({ example: '干饭' })
  name!: string;

  @ApiProperty({ enum: ['preset', 'custom'], example: 'preset' })
  source!: TagSource;

  @ApiProperty({
    example: '2026-04-22T18:30:00.000Z',
    description: 'custom tag 的创建时间；preset 恒为空串',
  })
  createdAt!: string;
}

export class TagListDto implements TagListShape {
  @ApiProperty({ type: [TagDto] })
  items!: TagDto[];
}

export class TagActionResultDto implements TagActionShape {
  @ApiProperty({ example: true })
  ok!: true;
}
