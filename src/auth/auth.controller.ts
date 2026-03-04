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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  SendOtpDto,
  SignupStep1Dto,
  SignupStep2Dto,
  VerifyOtpDto,
} from './dto/auth.dto';
import { AccessTokenGuard } from './guards/access-token.guard';
import { RefreshTokenGuard } from './guards/refresh-token.guard';

@ApiTags('Auth')
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

  @ApiOperation({ summary: 'Signup Step 1 - Basic user details' })
  @Post('signup/step1')
  async signupStep1(@Body() dto: SignupStep1Dto) {
    return this.authService.signupStep1(dto);
  }

  @ApiOperation({ summary: 'Signup Step 2 - Company/business details' })
  @Post('signup/step2')
  async signupStep2(@Body() dto: SignupStep2Dto) {
    return this.authService.signupStep2(dto);
  }

  @ApiOperation({ summary: 'Get signup draft status by email' })
  @ApiQuery({ name: 'email', type: String, description: 'User email' })
  @Get('signup/status')
  async getDraftStatus(@Query('email') email: string) {
    return this.authService.getDraftStatus(email);
  }

  @ApiOperation({ summary: 'Send OTP to email for login' })
  @Post('login/send-otp')
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @ApiOperation({ summary: 'Verify OTP and login' })
  @Post('login/verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyOtp(dto);
    this.setRefreshTokenCookie(res, result.refreshToken);
    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @ApiOperation({ summary: 'Refresh access token' })
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

  @ApiOperation({ summary: 'Logout user' })
  @ApiBearerAuth()
  @Post('logout')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    this.clearRefreshTokenCookie(res);
    return this.authService.logout(req.user.userId);
  }

  @ApiOperation({ summary: 'Get authenticated user profile' })
  @ApiBearerAuth()
  @Get('profile')
  @UseGuards(AccessTokenGuard)
  async getProfile(@Req() req: any) {
    return this.authService.getProfile(req.user.userId);
  }
}
