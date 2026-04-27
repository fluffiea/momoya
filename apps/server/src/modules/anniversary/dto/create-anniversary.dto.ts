import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { CreateAnniversaryInputDto } from '@momoya/shared';
import {
  ANNIVERSARY_NAME_MAX,
  ANNIVERSARY_NAME_MIN,
} from '@momoya/shared';

export class CreateAnniversaryDto implements CreateAnniversaryInputDto {
  @ApiProperty({
    example: '结婚纪念',
    minLength: ANNIVERSARY_NAME_MIN,
    maxLength: ANNIVERSARY_NAME_MAX,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(ANNIVERSARY_NAME_MIN)
  @MaxLength(ANNIVERSARY_NAME_MAX, {
    message: `纪念日名字最长 ${ANNIVERSARY_NAME_MAX} 字符`,
  })
  name!: string;

  @ApiProperty({
    example: '2024-05-20T00:00:00.000Z',
    description: 'ISO 日期字符串；服务端会归一化到该日期的 UTC 零点',
  })
  @IsDateString()
  date!: string;
}
