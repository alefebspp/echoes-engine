import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { seconds, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  login(@Body() loginDto: LoginDto): Promise<{ token: string }> {
    return this.authService.loginWithCredentials(
      loginDto.email,
      loginDto.password,
    );
  }
}
