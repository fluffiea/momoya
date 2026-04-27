import { ApiProperty } from '@nestjs/swagger';

export class HealthDataDto {
  @ApiProperty({ example: 'ok', enum: ['ok'] })
  status!: 'ok';

  @ApiProperty({ example: 'up', enum: ['up', 'down'] })
  mongo!: 'up' | 'down';
}
