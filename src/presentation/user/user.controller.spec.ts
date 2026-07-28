import { Test, TestingModule } from '@nestjs/testing';
import { CreateUserUseCase } from 'src/application/user/create-user-use-case';
import { DeleteUserUseCase } from 'src/application/user/delete-user-use-case';
import { GetUserByIdUseCase } from 'src/application/user/get-user-by-id-use-case';
import { ListUsersUseCase } from 'src/application/user/list-users-use-case';
import { UpdateUserUseCase } from 'src/application/user/update-user-use-case';
import { User } from 'src/domain/user/user';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserController } from './user.controller';

describe('UserController', () => {
  let controller: UserController;
  let createUserUseCase: jest.Mocked<Pick<CreateUserUseCase, 'execute'>>;
  let listUsersUseCase: jest.Mocked<Pick<ListUsersUseCase, 'execute'>>;
  let getUserByIdUseCase: jest.Mocked<Pick<GetUserByIdUseCase, 'execute'>>;
  let updateUserUseCase: jest.Mocked<Pick<UpdateUserUseCase, 'execute'>>;
  let deleteUserUseCase: jest.Mocked<Pick<DeleteUserUseCase, 'execute'>>;

  const user = User.reconstitute({
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Jane',
    surname: 'Doe',
    email: 'jane@example.com',
    passwordHash: 'hashed',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-02T00:00:00.000Z'),
  });

  const response = UserResponseDto.fromDomain(user);

  const createUserDto: CreateUserDto = {
    name: user.getName(),
    surname: user.getSurname(),
    email: user.getEmail().toString(),
    password: 'password123',
  };

  beforeEach(async () => {
    createUserUseCase = { execute: jest.fn() };
    listUsersUseCase = { execute: jest.fn() };
    getUserByIdUseCase = { execute: jest.fn() };
    updateUserUseCase = { execute: jest.fn() };
    deleteUserUseCase = { execute: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: CreateUserUseCase, useValue: createUserUseCase },
        { provide: ListUsersUseCase, useValue: listUsersUseCase },
        { provide: GetUserByIdUseCase, useValue: getUserByIdUseCase },
        { provide: UpdateUserUseCase, useValue: updateUserUseCase },
        { provide: DeleteUserUseCase, useValue: deleteUserUseCase },
      ],
    }).compile();

    controller = module.get(UserController);
  });

  it('create delegates to CreateUserUseCase', async () => {
    createUserUseCase.execute.mockResolvedValue(user);

    await expect(controller.create(createUserDto)).resolves.toEqual(response);
    expect(createUserUseCase.execute).toHaveBeenCalledWith(createUserDto);
  });

  it('findAll delegates to ListUsersUseCase', async () => {
    listUsersUseCase.execute.mockResolvedValue([user]);

    await expect(controller.findAll()).resolves.toEqual([response]);
    expect(listUsersUseCase.execute).toHaveBeenCalled();
  });

  it('findMe delegates to GetUserByIdUseCase with the authenticated user id', async () => {
    getUserByIdUseCase.execute.mockResolvedValue(user);

    await expect(
      controller.findMe({
        user: { userId: user.getId().toString(), email: user.getEmail().toString() },
      } as never),
    ).resolves.toEqual(response);
    expect(getUserByIdUseCase.execute).toHaveBeenCalledWith(
      user.getId().toString(),
    );
  });

  it('findOne delegates to GetUserByIdUseCase', async () => {
    getUserByIdUseCase.execute.mockResolvedValue(user);

    await expect(
      controller.findOne(user.getId().toString()),
    ).resolves.toEqual(response);
    expect(getUserByIdUseCase.execute).toHaveBeenCalledWith(
      user.getId().toString(),
    );
  });

  it('update delegates to UpdateUserUseCase', async () => {
    const updateUserDto: UpdateUserDto = { email: 'janet@example.com' };
    const updated = User.reconstitute({
      id: user.getId().toString(),
      name: user.getName(),
      surname: user.getSurname(),
      email: 'janet@example.com',
      passwordHash: user.getPasswordHash(),
      createdAt: user.getCreatedAt(),
      updatedAt: user.getUpdatedAt(),
    });
    updateUserUseCase.execute.mockResolvedValue(updated);

    await expect(
      controller.update(user.getId().toString(), updateUserDto),
    ).resolves.toEqual(UserResponseDto.fromDomain(updated));
    expect(updateUserUseCase.execute).toHaveBeenCalledWith(
      user.getId().toString(),
      updateUserDto,
    );
  });

  it('remove delegates to DeleteUserUseCase', async () => {
    deleteUserUseCase.execute.mockResolvedValue(undefined);

    await expect(
      controller.remove(user.getId().toString()),
    ).resolves.toBeUndefined();
    expect(deleteUserUseCase.execute).toHaveBeenCalledWith(
      user.getId().toString(),
    );
  });
});
