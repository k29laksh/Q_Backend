import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';

// Extract JWT from the httpOnly cookie named 'refresh_token'
function cookieExtractor(req: Request): string | null {
  if (req && req.cookies) {
    return req.cookies['refresh_token'] ?? null;
  }
  return null;
}

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: cookieExtractor,
      secretOrKey: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    } as any);
  }

  validate(req: Request, payload: { sub: string; email: string }) {
    const refreshToken = req.cookies['refresh_token'];
    return { userId: payload.sub, email: payload.email, refreshToken };
  }
}
