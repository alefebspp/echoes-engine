import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  PASSWORD_HASHER,
  USER_REPOSITORY,
} from 'src/infrastructure/nest/injection-tokens';
import type { PasswordHasher } from 'src/domain/ports/password-hasher';
import type { User } from 'src/domain/user/user';
import type { UserRepository } from 'src/domain/user/user-repository';
import { Password } from 'src/domain/value-objects/password';
import { InvalidPasswordException } from 'src/domain/exceptions/invalid-password-exception';

type AuthenticatedIdentity = {
  id: string;
  email: string;
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<AuthenticatedIdentity | null> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      return null;
    }

    const isValid = await this.comparePassword(password, user);
    if (!isValid) {
      return null;
    }

    return {
      id: user.getId().toString(),
      email: user.getEmail().toString(),
    };
  }

  login(user: AuthenticatedIdentity): { token: string } {
    const payload = { sub: user.id, email: user.email };
    return {
      token: this.jwtService.sign(payload),
    };
  }

  async loginWithCredentials(
    email: string,
    password: string,
  ): Promise<{ token: string }> {
    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException({ error: 'Invalid credentials' });
    }

    return this.login(user);
  }

  private async comparePassword(
    password: string,
    user: User,
  ): Promise<boolean> {
    try {
      return await this.passwordHasher.compare(
        new Password(password),
        user.getPasswordHash(),
      );
    } catch (error) {
      if (error instanceof InvalidPasswordException) {
        return false;
      }
      throw error;
    }
  }
}
