import {
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  ApiResponseBaseDto,
  ApiResponseOf,
} from '../../common/dto/api-response.dto';
import { ErrorKey } from '../../common/constants/error-keys';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import {
  UploadImageBodyDto,
  UploadImageResultDto,
} from './dto/upload-image.dto';
import { UploadService } from './upload.service';

@ApiTags('文件上传')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('image')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @UseInterceptors(
    FileInterceptor('file', {
      // 选项在 controller metadata 构建时求值，因此延迟到 module 里注入。
    }),
  )
  @ApiOperation({
    summary: '上传图片（头像 / moments 通用）',
    description:
      '字段名固定为 `file`，MIME 限 image/jpeg | image/png | image/webp，单张 ≤ 5 MB。' +
      '返回的 `url` 为相对路径，可直接作为 `PATCH /users/me` 的 avatar 值；`absoluteUrl` 拼好了 STATIC_BASE_URL，便于前端回显。',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadImageBodyDto })
  @ApiOkResponse({ type: ApiResponseOf(UploadImageResultDto) })
  @ApiUnsupportedMediaTypeResponse({
    description: 'MIME 不在白名单',
    type: ApiResponseBaseDto,
  })
  @ApiPayloadTooLargeResponse({
    description: '文件超过大小限制',
    type: ApiResponseBaseDto,
  })
  uploadImage(
    @UploadedFile() file: Express.Multer.File | undefined,
  ): UploadImageResultDto {
    if (!file) {
      throw new HttpException(
        { message: '缺少 file 字段', errorKey: ErrorKey.E_UPLOAD_MISSING },
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.uploadService.finalize(file);
  }
}
