import { Test, TestingModule } from '@nestjs/testing';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<
    Pick<UsersService, 'create' | 'findAll' | 'findOne' | 'update' | 'remove'>
  >;

  const user: User = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Jane',
    surname: 'Doe',
    email: 'jane@example.com',
    password: 'hashed',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const createUserDto: CreateUserDto = {
    name: user.name,
    surname: user.surname,
    email: user.email,
    password: 'password123',
  };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: service }],
    }).compile();

    controller = module.get(UsersController);
  });

  it('create delegates to UsersService', async () => {
    service.create.mockResolvedValue(user);

    await expect(controller.create(createUserDto)).resolves.toEqual(user);
    expect(service.create).toHaveBeenCalledWith(createUserDto);
  });

  it('findAll delegates to UsersService', async () => {
    service.findAll.mockResolvedValue([user]);

    await expect(controller.findAll()).resolves.toEqual([user]);
    expect(service.findAll).toHaveBeenCalled();
  });

  it('findMe delegates to UsersService with the authenticated user id', async () => {
    service.findOne.mockResolvedValue(user);

    await expect(
      controller.findMe({
        user: { userId: user.id, email: user.email },
      } as never),
    ).resolves.toEqual(user);
    expect(service.findOne).toHaveBeenCalledWith(user.id);
  });

  it('findOne delegates to UsersService', async () => {
    service.findOne.mockResolvedValue(user);

    await expect(controller.findOne(user.id)).resolves.toEqual(user);
    expect(service.findOne).toHaveBeenCalledWith(user.id);
  });

  it('update delegates to UsersService', async () => {
    const updateUserDto: UpdateUserDto = { email: 'janet@example.com' };
    service.update.mockResolvedValue({ ...user, email: 'janet@example.com' });

    await expect(controller.update(user.id, updateUserDto)).resolves.toEqual({
      ...user,
      email: 'janet@example.com',
    });
    expect(service.update).toHaveBeenCalledWith(user.id, updateUserDto);
  });

  it('remove delegates to UsersService', async () => {
    service.remove.mockResolvedValue(undefined);

    await expect(controller.remove(user.id)).resolves.toBeUndefined();
    expect(service.remove).toHaveBeenCalledWith(user.id);
  });
});
