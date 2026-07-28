import type { User } from 'src/domain/user/user';
import type { UserRepository } from 'src/domain/user/user-repository';

export class ListUsersUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  execute(): Promise<User[]> {
    return this.userRepository.findAll();
  }
}
