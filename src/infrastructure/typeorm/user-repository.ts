import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/domain/user/user';
import type { UserRepository } from 'src/domain/user/user-repository';
import { UserOrmEntity } from './entities/user.entity';
import { UserMapper } from './user-mapper';

@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly users: Repository<UserOrmEntity>,
  ) {}

  async create(user: User): Promise<User> {
    const entity = UserMapper.toOrm(user);
    const saved = await this.users.save(entity);
    return UserMapper.toDomain(saved);
  }

  async findById(id: string): Promise<User | null> {
    const entity = await this.users.findOneBy({ id });
    return entity ? UserMapper.toDomain(entity) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const entity = await this.users.findOneBy({
      email: email.trim().toLowerCase(),
    });
    return entity ? UserMapper.toDomain(entity) : null;
  }

  async findAll(): Promise<User[]> {
    const entities = await this.users.find();
    return entities.map((entity) => UserMapper.toDomain(entity));
  }

  async update(user: User): Promise<User> {
    const entity = UserMapper.toOrm(user);
    const saved = await this.users.save(entity);
    return UserMapper.toDomain(saved);
  }

  async delete(id: string): Promise<void> {
    await this.users.delete(id);
  }
}
