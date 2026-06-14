import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './user.entity';
import { UsersService } from './users.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<Pick<Repository<User>, 'create' | 'save' | 'find' | 'findOneBy' | 'delete'>>;

  const createUserDto: CreateUserDto = {
    name: 'Jane',
    surname: 'Doe',
    email: 'jane@example.com',
    password: 'password123',
  };

  const user: User = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: createUserDto.name,
    surname: createUserDto.surname,
    email: createUserDto.email,
    password: 'hashed-password',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOneBy: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get(UsersService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('hashes the password and saves a new user', async () => {
      repository.findOneBy.mockResolvedValue(null);
      repository.create.mockReturnValue(user);
      repository.save.mockResolvedValue(user);

      const result = await service.create(createUserDto);

      expect(bcrypt.hash).toHaveBeenCalledWith(createUserDto.password, 10);
      expect(repository.create).toHaveBeenCalledWith({
        ...createUserDto,
        password: 'hashed-password',
      });
      expect(repository.save).toHaveBeenCalledWith(user);
      expect(result).toEqual(user);
    });

    it('throws when email is already registered', async () => {
      repository.findOneBy.mockResolvedValue(user);

      await expect(service.create(createUserDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns all users', async () => {
      repository.find.mockResolvedValue([user]);

      await expect(service.findAll()).resolves.toEqual([user]);
    });
  });

  describe('findOne', () => {
    it('returns a user by id', async () => {
      repository.findOneBy.mockResolvedValue(user);

      await expect(service.findOne(user.id)).resolves.toEqual(user);
    });

    it('throws when user is not found', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne(user.id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByEmail', () => {
    it('returns a user when found', async () => {
      repository.findOneBy.mockResolvedValue(user);

      await expect(service.findByEmail(user.email)).resolves.toEqual(user);
    });
  });

  describe('update', () => {
    it('updates and saves the user', async () => {
      const updateUserDto: UpdateUserDto = { email: 'janet@example.com' };
      repository.findOneBy.mockResolvedValue(user);
      repository.save.mockResolvedValue({ ...user, email: 'janet@example.com' });

      const result = await service.update(user.id, updateUserDto);

      expect(repository.save).toHaveBeenCalled();
      expect(result.email).toBe('janet@example.com');
    });

    it('hashes password when provided', async () => {
      repository.findOneBy.mockResolvedValue(user);
      repository.save.mockImplementation((entity) => Promise.resolve(entity as User));

      await service.update(user.id, { password: 'newpassword1' });

      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword1', 10);
    });

    it('throws when email belongs to another user', async () => {
      repository.findOneBy
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce({
          ...user,
          id: '660e8400-e29b-41d4-a716-446655440001',
          email: 'other@example.com',
        });

      await expect(
        service.update(user.id, { email: 'other@example.com' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('deletes the user', async () => {
      repository.delete.mockResolvedValue({ affected: 1, raw: [] });

      await expect(service.remove(user.id)).resolves.toBeUndefined();
    });

    it('throws when user is not found', async () => {
      repository.delete.mockResolvedValue({ affected: 0, raw: [] });

      await expect(service.remove(user.id)).rejects.toThrow(NotFoundException);
    });
  });
});
