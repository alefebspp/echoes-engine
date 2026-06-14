import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<Pick<UsersService, 'findByEmail'>>;
  let jwtService: jest.Mocked<Pick<JwtService, 'sign'>>;

  const user: User = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Demo',
    surname: 'User',
    email: 'demo@echoes.local',
    password: 'hashed-password',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue('signed-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get(AuthService);
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('returns the user when credentials are valid', async () => {
      usersService.findByEmail.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.validateUser(user.email, 'demo1234'),
      ).resolves.toEqual(user);
    });

    it('returns null when user is not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.validateUser(user.email, 'demo1234'),
      ).resolves.toBeNull();
    });

    it('returns null when password is invalid', async () => {
      usersService.findByEmail.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.validateUser(user.email, 'wrong-password'),
      ).resolves.toBeNull();
    });
  });

  describe('loginWithCredentials', () => {
    it('returns a signed token for valid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.loginWithCredentials(user.email, 'demo1234'),
      ).resolves.toEqual({ token: 'signed-token' });
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: user.id,
        email: user.email,
      });
    });

    it('throws UnauthorizedException for invalid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.loginWithCredentials(user.email, 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
