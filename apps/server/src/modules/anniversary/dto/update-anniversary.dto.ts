import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { UpdateAnniversaryInputDto } from '@momoya/shared';
import {
  ANNIVERSARY_NAME_MAX,
  ANNIVERSARY_NAME_MIN,
} from '@momoya/shared';

export class UpdateAnniversaryDto implements UpdateAnniversaryInputDto {
  @ApiPropertyOptional({
    example: '结婚纪念',
    minLength: ANNIVERSARY_NAME_MIN,
    maxLength: ANNIVERSARY_NAME_MAX,
    description: 'system 纪念日不允许改 name',
  })
  @IsOptional()
  @IsString()
  @MinLength(ANNIVERSARY_NAME_MIN)
  @MaxLength(ANNIVERSARY_NAME_MAX)
  name?: string;

  @ApiPropertyOptional({ example: '2024-05-20T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  date?: string;
}
