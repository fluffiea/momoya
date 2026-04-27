import { ApiProperty } from '@nestjs/swagger';
import { IsJWT } from 'class-validator';
import type { RefreshInputDto } from '@momoya/shared';

export class RefreshDto implements RefreshInputDto {
  @ApiProperty({
    description: '登录时返回的 refreshToken',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsJWT()
  refreshToken!: string;
}
