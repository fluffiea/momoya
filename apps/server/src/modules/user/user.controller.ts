import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorKey } from '../../common/constants/error-keys';
import { ApiResponseOf } from '../../common/dto/api-response.dto';
import { toIsoString } from '../../common/utils/date';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthUser } from '../auth/types/jwt-payload';
import { MeDto } from './dto/me.dto';
import { PartnerBriefDto } from './dto/partner.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UserService } from './user.service';

@ApiTags('用户资料')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '更新当前用户资料（昵称 / 签名 / 头像）',
    description:
      '三个字段都可选，至少传一个才会真实写库。avatar 需先调用 POST /upload/image 上传后用返回的 `url` 填入。',
  })
  @ApiBody({ type: UpdateMeDto })
  @ApiOkResponse({ type: ApiResponseOf(MeDto) })
  async updateMe(
    @CurrentUser() auth: AuthUser,
    @Body() dto: UpdateMeDto,
  ): Promise<MeDto> {
    const updated = await this.userService.updateProfile(auth.userId, dto);
    if (!updated) {
      throw new UnauthorizedException({
        message: '用户不存在',
        errorKey: ErrorKey.E_AUTH_INVALID,
      });
    }
    return this.userService.toMe(updated);
  }

  @Get('partner')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '获取当前用户的 partner 简要信息',
    description: '用于时间轴顶部的「双人关系卡片」。未绑定 partner 返回 null。',
  })
  @ApiOkResponse({ type: ApiResponseOf(PartnerBriefDto) })
  async getPartner(
    @CurrentUser() auth: AuthUser,
  ): Promise<PartnerBriefDto | null> {
    const me = await this.userService.findById(auth.userId);
    if (!me) {
      throw new UnauthorizedException({
        message: '用户不存在',
        errorKey: ErrorKey.E_AUTH_INVALID,
      });
    }
    if (!me.partnerId) return null;
    const partner = await this.userService.findById(me.partnerId);
    if (!partner) return null;
    // Mongoose `timestamps: true` 自动维护 createdAt；文档上无 @Prop 声明，用 unknown 透传 + toIsoString 收敛。
    const createdAt: unknown = (partner as unknown as { createdAt?: unknown })
      .createdAt;
    return {
      id: String(partner._id),
      username: partner.username,
      nickname: partner.nickname,
      avatar: partner.avatar,
      createdAt: toIsoString(createdAt),
    };
  }
}
