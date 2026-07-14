import { UserNotFoundException } from './exceptions/user-not-found-exception';
import type { User } from 'src/domain/user/user';
import type { UserRepository } from 'src/domain/user/user-repository';

export class GetUserByIdUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new UserNotFoundException(id);
    }

    return user;
  }
}
