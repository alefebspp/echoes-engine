import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreateUserUseCase } from 'src/application/user/create-user-use-case';
import { DeleteUserUseCase } from 'src/application/user/delete-user-use-case';
import { GetUserByIdUseCase } from 'src/application/user/get-user-by-id-use-case';
import { ListUsersUseCase } from 'src/application/user/list-users-use-case';
import { UpdateUserUseCase } from 'src/application/user/update-user-use-case';
import type { PasswordHasher } from 'src/domain/ports/password-hasher';
import type { UserRepository } from 'src/domain/user/user-repository';
import { BcryptPasswordHasher } from 'src/infrastructure/bcrypt/password-hasher';
import {
  PASSWORD_HASHER,
  USER_REPOSITORY,
} from 'src/infrastructure/nest/injection-tokens';
import { UserOrmEntity } from 'src/infrastructure/typeorm/entities/user.entity';
import { TypeOrmUserRepository } from 'src/infrastructure/typeorm/user-repository';
import { UserController } from './user.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserOrmEntity])],
  controllers: [UserController],
  providers: [
    {
      provide: USER_REPOSITORY,
      useClass: TypeOrmUserRepository,
    },
    {
      provide: PASSWORD_HASHER,
      useClass: BcryptPasswordHasher,
    },
    {
      provide: CreateUserUseCase,
      useFactory: (
        userRepository: UserRepository,
        passwordHasher: PasswordHasher,
      ) => new CreateUserUseCase(userRepository, passwordHasher),
      inject: [USER_REPOSITORY, PASSWORD_HASHER],
    },
    {
      provide: ListUsersUseCase,
      useFactory: (userRepository: UserRepository) =>
        new ListUsersUseCase(userRepository),
      inject: [USER_REPOSITORY],
    },
    {
      provide: GetUserByIdUseCase,
      useFactory: (userRepository: UserRepository) =>
        new GetUserByIdUseCase(userRepository),
      inject: [USER_REPOSITORY],
    },
    {
      provide: UpdateUserUseCase,
      useFactory: (
        userRepository: UserRepository,
        passwordHasher: PasswordHasher,
      ) => new UpdateUserUseCase(userRepository, passwordHasher),
      inject: [USER_REPOSITORY, PASSWORD_HASHER],
    },
    {
      provide: DeleteUserUseCase,
      useFactory: (userRepository: UserRepository) =>
        new DeleteUserUseCase(userRepository),
      inject: [USER_REPOSITORY],
    },
  ],
  exports: [USER_REPOSITORY, PASSWORD_HASHER],
})
export class UserModule {}
