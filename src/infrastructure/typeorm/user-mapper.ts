import { User } from 'src/domain/user/user';
import { UserOrmEntity } from './entities/user.entity';

export class UserMapper {
  static toDomain(entity: UserOrmEntity): User {
    return User.reconstitute({
      id: entity.id,
      name: entity.name,
      surname: entity.surname,
      email: entity.email,
      passwordHash: entity.password,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  static toOrm(user: User): UserOrmEntity {
    const entity = new UserOrmEntity();
    entity.id = user.getId().toString();
    entity.name = user.getName();
    entity.surname = user.getSurname();
    entity.email = user.getEmail().toString();
    entity.password = user.getPasswordHash();
    entity.createdAt = user.getCreatedAt();
    entity.updatedAt = user.getUpdatedAt();
    return entity;
  }
}
