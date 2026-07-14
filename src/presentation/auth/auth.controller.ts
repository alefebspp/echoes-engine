import { Body, Controller, Post, Res, UseFilters, UseGuards } from '@nestjs/common';
import { seconds, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';
import { LoginUseCase } from 'src/application/auth/login-use-case';
import { DomainExceptionFilter } from 'src/infrastructure/nest/domain-exception.filter';
import { AUTH_COOKIE_NAME, JWT_COOKIE_MAX_AGE_MS } from './auth.constants';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';

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
@UseFilters(DomainExceptionFilter)
export class AuthController {
  constructor(private readonly loginUseCase: LoginUseCase) {}

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.loginUseCase.execute({
      email: loginDto.email,
      password: loginDto.password,
    });

    response.cookie(
      AUTH_COOKIE_NAME,
      result.token,
      authCookieOptions(JWT_COOKIE_MAX_AGE_MS),
    );

    return LoginResponseDto.fromResult(result);
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response): { ok: true } {
    response.clearCookie(AUTH_COOKIE_NAME, authCookieOptions());

    return { ok: true };
  }
}
