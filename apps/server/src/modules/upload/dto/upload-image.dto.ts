import { ApiProperty } from '@nestjs/swagger';
import type { UploadImageResultDto as UploadImageResultShape } from '@momoya/shared';

/**
 * multipart/form-data 里的 file 字段，仅用于 Swagger 展示。
 * 实际上传由 FileInterceptor + multer diskStorage 接管。
 */
export class UploadImageBodyDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: '待上传的图片文件（jpeg / png / webp，≤ 5 MB）',
  })
  file!: unknown;
}

export class UploadImageResultDto implements UploadImageResultShape {
  @ApiProperty({
    example:
      '/static/2026/04/23/2026-04-23-14-05-30-a1b2c3d4.webp',
    description: '相对路径（挂在 STATIC_BASE_URL 下对外暴露）',
  })
  url!: string;

  @ApiProperty({
    example:
      'https://api.momoya.example.com/static/2026/04/23/2026-04-23-14-05-30-a1b2c3d4.webp',
    description: '拼好 STATIC_BASE_URL 的绝对地址，前端可直接使用',
  })
  absoluteUrl!: string;

  @ApiProperty({ example: 'image/webp' })
  mimeType!: string;

  @ApiProperty({ example: 124578, description: '文件大小（字节）' })
  size!: number;
}
