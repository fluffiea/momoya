import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  ApiResponseBaseDto,
  ApiResponseOf,
} from '../../common/dto/api-response.dto';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import {
  ChangePasswordResultDto,
  LoginResultDto,
  LogoutResultDto,
  MeDto,
  TokenPairDto,
} from './dto/token-pair.dto';
import { JwtAccessGuard } from './guards/jwt-access.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import type { AuthUser } from './types/jwt-payload';

@ApiTags('登录鉴权')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '账号密码登录',
    description:
      '校验通过后会生成新的 sessionId，同一账号之前在其他设备上的 token 立即失效（E_SESSION_KICKED）。',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: ApiResponseOf(LoginResultDto) })
  @ApiUnauthorizedResponse({
    description: '账号或密码错误',
    type: ApiResponseBaseDto,
  })
  login(@Body() dto: LoginDto): Promise<LoginResultDto> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  @ApiOperation({
    summary: '用 refresh token 换一对新的 access/refresh',
    description:
      'refresh token 过期或被其他设备顶号后，本接口会返回 401，客户端应踢回登录页。',
  })
  @ApiBody({ type: RefreshDto })
  @ApiOkResponse({ type: ApiResponseOf(TokenPairDto) })
  refresh(
    @CurrentUser() user: AuthUser,
    @Body() _dto: RefreshDto,
  ): Promise<TokenPairDto> {
    return this.authService.refresh(user.userId, user.sessionId);
  }

  @Get('me')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '获取当前登录用户基本信息' })
  @ApiOkResponse({ type: ApiResponseOf(MeDto) })
  me(@CurrentUser() user: AuthUser): Promise<MeDto> {
    return this.authService.getMe(user.userId);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '修改密码',
    description:
      '需要登录态。校验旧密码通过后更新密码并刷新 session，返回的新 tokens 可无缝续用；其他设备下一次请求即被踢下线。',
  })
  @ApiBody({ type: ChangePasswordDto })
  @ApiOkResponse({ type: ApiResponseOf(ChangePasswordResultDto) })
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<ChangePasswordResultDto> {
    return this.authService.changePassword(user.userId, user.sessionId, dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '主动登出（清空服务端 session）' })
  @ApiOkResponse({ type: ApiResponseOf(LogoutResultDto) })
  async logout(@CurrentUser() user: AuthUser): Promise<LogoutResultDto> {
    await this.authService.logout(user.userId);
    return { ok: true };
  }
}
