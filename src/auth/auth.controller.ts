import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { seconds, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';
import { AUTH_COOKIE_NAME, JWT_COOKIE_MAX_AGE_MS } from './auth.constants';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

function authCookieOptions(maxAge?: number): CookieOptions {
  const options: CookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };

  if (maxAge !== undefined) {
    return { ...options, maxAge };
  }

  return options;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ token: string }> {
    const { token } = await this.authService.loginWithCredentials(
      loginDto.email,
      loginDto.password,
    );

    response.cookie(
      AUTH_COOKIE_NAME,
      token,
      authCookieOptions(JWT_COOKIE_MAX_AGE_MS),
    );

    return { token };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response): { ok: true } {
    response.clearCookie(AUTH_COOKIE_NAME, authCookieOptions());

    return { ok: true };
  }
}
