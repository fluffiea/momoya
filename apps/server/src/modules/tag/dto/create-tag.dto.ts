import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import type { CreateTagInputDto } from '@momoya/shared';
import { TAG_NAME_MAX } from '@momoya/shared';

export class CreateTagDto implements CreateTagInputDto {
  @ApiProperty({
    example: '约会',
    minLength: 1,
    maxLength: TAG_NAME_MAX,
    description: `1~${TAG_NAME_MAX} 字；不能含空白字符`,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(TAG_NAME_MAX)
  @Matches(/^\S+$/, { message: 'tag 名称不能含空白字符' })
  name!: string;
}
