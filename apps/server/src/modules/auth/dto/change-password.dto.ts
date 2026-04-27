import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import type { ChangePasswordInputDto } from '@momoya/shared';
import { PASSWORD_MAX, PASSWORD_MIN } from '@momoya/shared';

export class ChangePasswordDto implements ChangePasswordInputDto {
  @ApiProperty({
    description: '当前密码',
    example: '251212',
    minLength: PASSWORD_MIN,
    maxLength: PASSWORD_MAX,
  })
  @IsString()
  @MinLength(PASSWORD_MIN)
  @MaxLength(PASSWORD_MAX)
  oldPassword!: string;

  @ApiProperty({
    description: `新密码，长度 ${PASSWORD_MIN}-${PASSWORD_MAX}`,
    example: 'new-password-123',
    minLength: PASSWORD_MIN,
    maxLength: PASSWORD_MAX,
  })
  @IsString()
  @MinLength(PASSWORD_MIN)
  @MaxLength(PASSWORD_MAX)
  newPassword!: string;
}
