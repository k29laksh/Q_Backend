import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { type Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, SignupStep1Dto, SignupStep2Dto } from './dto/auth.dto';
import { AccessTokenGuard } from './guards/access-token.guard';
import { RefreshTokenGuard } from './guards/refresh-token.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private setRefreshTokenCookie(res: Response, refreshToken: string) {
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private clearRefreshTokenCookie(res: Response) {
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/auth/refresh',
    });
  }

  @Post('signup/step1')
  async signupStep1(@Body() dto: SignupStep1Dto) {
    return this.authService.signupStep1(dto);
  }

  @Post('signup/step2')
  async signupStep2(@Body() dto: SignupStep2Dto) {
    return this.authService.signupStep2(dto);
  }

  @Get('signup/status')
  async getDraftStatus(@Query('email') email: string) {
    return this.authService.getDraftStatus(email);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    this.setRefreshTokenCookie(res, result.refreshToken);
    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Post('refresh')
  @UseGuards(RefreshTokenGuard)
  @HttpCode(HttpStatus.OK)
  async refreshTokens(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = req.user.userId;
    const refreshToken = req.user.refreshToken;
    const tokens = await this.authService.refreshTokens(userId, refreshToken);
    this.setRefreshTokenCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Post('logout')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    this.clearRefreshTokenCookie(res);
    return this.authService.logout(req.user.userId);
  }

  @Get('profile')
  @UseGuards(AccessTokenGuard)
  async getProfile(@Req() req: any) {
    return this.authService.getProfile(req.user.userId);
  }
}
