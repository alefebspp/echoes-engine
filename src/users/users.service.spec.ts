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
    email: 'jane@example.com',
    password: 'password123',
    name: 'Jane',
    surname: 'Doe',
  };

  const user: User = {
    id: 1,
    email: createUserDto.email,
    password: 'hashed-password',
    name: createUserDto.name,
    surname: createUserDto.surname,
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

      await expect(service.findOne(1)).resolves.toEqual(user);
    });

    it('throws when user is not found', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
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
      const updateUserDto: UpdateUserDto = { name: 'Janet' };
      repository.findOneBy.mockResolvedValue(user);
      repository.save.mockResolvedValue({ ...user, name: 'Janet' });

      const result = await service.update(1, updateUserDto);

      expect(repository.save).toHaveBeenCalled();
      expect(result.name).toBe('Janet');
    });

    it('hashes password when provided', async () => {
      repository.findOneBy.mockResolvedValue(user);
      repository.save.mockImplementation((entity) => Promise.resolve(entity as User));

      await service.update(1, { password: 'newpassword1' });

      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword1', 10);
    });

    it('throws when email belongs to another user', async () => {
      repository.findOneBy
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce({ ...user, id: 2, email: 'other@example.com' });

      await expect(
        service.update(1, { email: 'other@example.com' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('deletes the user', async () => {
      repository.delete.mockResolvedValue({ affected: 1, raw: [] });

      await expect(service.remove(1)).resolves.toBeUndefined();
    });

    it('throws when user is not found', async () => {
      repository.delete.mockResolvedValue({ affected: 0, raw: [] });

      await expect(service.remove(99)).rejects.toThrow(NotFoundException);
    });
  });
});
