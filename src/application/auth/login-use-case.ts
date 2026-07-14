import { InvalidCredentialsException } from './exceptions/invalid-credentials-exception';
import { InvalidPasswordException } from 'src/domain/exceptions/invalid-password-exception';
import type { PasswordHasher } from 'src/domain/ports/password-hasher';
import type { TokenSigner } from 'src/domain/ports/token-signer';
import type { User } from 'src/domain/user/user';
import type { UserRepository } from 'src/domain/user/user-repository';
import { Password } from 'src/domain/value-objects/password';

export type LoginResult = {
  token: string;
};

export class LoginUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenSigner: TokenSigner,
  ) {}

  async execute(props: {
    email: string;
    password: string;
  }): Promise<LoginResult> {
    const user = await this.userRepository.findByEmail(props.email);
    if (!user) {
      throw new InvalidCredentialsException();
    }

    const isValid = await this.comparePassword(props.password, user);
    if (!isValid) {
      throw new InvalidCredentialsException();
    }

    return {
      token: this.tokenSigner.sign({
        userId: user.getId().toString(),
        email: user.getEmail().toString(),
      }),
    };
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
