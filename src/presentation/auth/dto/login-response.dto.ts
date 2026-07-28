import type { LoginResult } from 'src/application/auth/login-use-case';

export class LoginResponseDto {
  token: string;

  static fromResult(result: LoginResult): LoginResponseDto {
    const dto = new LoginResponseDto();
    dto.token = result.token;
    return dto;
  }
}
