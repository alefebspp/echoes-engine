import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  PASSWORD_HASHER,
  USER_REPOSITORY,
} from 'src/infrastructure/nest/injection-tokens';
import type { PasswordHasher } from 'src/domain/ports/password-hasher';
import { User } from 'src/domain/user/user';
import type { UserRepository } from 'src/domain/user/user-repository';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<Pick<UserRepository, 'findByEmail'>>;
  let passwordHasher: jest.Mocked<Pick<PasswordHasher, 'compare'>>;
  let jwtService: jest.Mocked<Pick<JwtService, 'sign'>>;

  const user = User.reconstitute({
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Demo',
    surname: 'User',
    email: 'demo@echoes.local',
    passwordHash: 'hashed-password',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const identity = {
    id: user.getId().toString(),
    email: user.getEmail().toString(),
  };

  beforeEach(async () => {
    userRepository = {
      findByEmail: jest.fn(),
    };
    passwordHasher = {
      compare: jest.fn(),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue('signed-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: USER_REPOSITORY, useValue: userRepository },
        { provide: PASSWORD_HASHER, useValue: passwordHasher },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get(AuthService);
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('returns the user when credentials are valid', async () => {
      userRepository.findByEmail.mockResolvedValue(user);
      passwordHasher.compare.mockResolvedValue(true);

      await expect(
        service.validateUser(identity.email, 'demo1234'),
      ).resolves.toEqual(identity);
    });

    it('returns null when user is not found', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(
        service.validateUser(identity.email, 'demo1234'),
      ).resolves.toBeNull();
    });

    it('returns null when password is invalid', async () => {
      userRepository.findByEmail.mockResolvedValue(user);
      passwordHasher.compare.mockResolvedValue(false);

      await expect(
        service.validateUser(identity.email, 'wrong-password'),
      ).resolves.toBeNull();
    });
  });

  describe('loginWithCredentials', () => {
    it('returns a signed token for valid credentials', async () => {
      userRepository.findByEmail.mockResolvedValue(user);
      passwordHasher.compare.mockResolvedValue(true);

      await expect(
        service.loginWithCredentials(identity.email, 'demo1234'),
      ).resolves.toEqual({ token: 'signed-token' });
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: identity.id,
        email: identity.email,
      });
    });

    it('throws UnauthorizedException for invalid credentials', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(
        service.loginWithCredentials(identity.email, 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
