import { InvalidCredentialsException } from './exceptions/invalid-credentials-exception';
import type { PasswordHasher } from 'src/domain/ports/password-hasher';
import type { TokenSigner } from 'src/domain/ports/token-signer';
import { User } from 'src/domain/user/user';
import type { UserRepository } from 'src/domain/user/user-repository';
import { LoginUseCase } from './login-use-case';

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;
  let userRepository: jest.Mocked<Pick<UserRepository, 'findByEmail'>>;
  let passwordHasher: jest.Mocked<Pick<PasswordHasher, 'compare'>>;
  let tokenSigner: jest.Mocked<Pick<TokenSigner, 'sign'>>;

  const user = User.reconstitute({
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Demo',
    surname: 'User',
    email: 'demo@echoes.local',
    passwordHash: 'hashed-password',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const credentials = {
    email: user.getEmail().toString(),
    password: 'demo1234',
  };

  beforeEach(() => {
    userRepository = {
      findByEmail: jest.fn(),
    };
    passwordHasher = {
      compare: jest.fn(),
    };
    tokenSigner = {
      sign: jest.fn().mockReturnValue('signed-token'),
    };

    useCase = new LoginUseCase(
      userRepository as UserRepository,
      passwordHasher as PasswordHasher,
      tokenSigner as TokenSigner,
    );
  });

  it('returns a signed token for valid credentials', async () => {
    userRepository.findByEmail.mockResolvedValue(user);
    passwordHasher.compare.mockResolvedValue(true);

    await expect(useCase.execute(credentials)).resolves.toEqual({
      token: 'signed-token',
    });
    expect(tokenSigner.sign).toHaveBeenCalledWith({
      userId: user.getId().toString(),
      email: user.getEmail().toString(),
    });
  });

  it('throws InvalidCredentialsException when user is not found', async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    await expect(useCase.execute(credentials)).rejects.toThrow(
      InvalidCredentialsException,
    );
    expect(tokenSigner.sign).not.toHaveBeenCalled();
  });

  it('throws InvalidCredentialsException when password is invalid', async () => {
    userRepository.findByEmail.mockResolvedValue(user);
    passwordHasher.compare.mockResolvedValue(false);

    await expect(
      useCase.execute({ ...credentials, password: 'wrong-password' }),
    ).rejects.toThrow(InvalidCredentialsException);
    expect(tokenSigner.sign).not.toHaveBeenCalled();
  });
});
