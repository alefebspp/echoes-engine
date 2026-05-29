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
    id: 1,
    email: 'jane@example.com',
    password: 'hashed',
    name: 'Jane',
    surname: 'Doe',
  };

  const createUserDto: CreateUserDto = {
    email: user.email,
    password: 'password123',
    name: user.name,
    surname: user.surname,
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

  it('findOne delegates to UsersService', async () => {
    service.findOne.mockResolvedValue(user);

    await expect(controller.findOne(1)).resolves.toEqual(user);
    expect(service.findOne).toHaveBeenCalledWith(1);
  });

  it('update delegates to UsersService', async () => {
    const updateUserDto: UpdateUserDto = { name: 'Janet' };
    service.update.mockResolvedValue({ ...user, name: 'Janet' });

    await expect(controller.update(1, updateUserDto)).resolves.toEqual({
      ...user,
      name: 'Janet',
    });
    expect(service.update).toHaveBeenCalledWith(1, updateUserDto);
  });

  it('remove delegates to UsersService', async () => {
    service.remove.mockResolvedValue(undefined);

    await expect(controller.remove(1)).resolves.toBeUndefined();
    expect(service.remove).toHaveBeenCalledWith(1);
  });
});
