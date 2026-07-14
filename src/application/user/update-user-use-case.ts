import { UserAlreadyExistsException } from './exceptions/user-already-exists-exception';
import { UserNotFoundException } from './exceptions/user-not-found-exception';
import type { User } from 'src/domain/user/user';
import type { UserRepository } from 'src/domain/user/user-repository';
import type { PasswordHasher } from 'src/domain/ports/password-hasher';
import { Password } from 'src/domain/value-objects/password';

export class UpdateUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(
    id: string,
    props: {
      name?: string;
      surname?: string;
      email?: string;
      password?: string;
    },
  ): Promise<User> {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new UserNotFoundException(id);
    }

    if (props.email !== undefined) {
      const existing = await this.userRepository.findByEmail(props.email);
      if (existing && !existing.getId().equals(user.getId())) {
        throw new UserAlreadyExistsException();
      }
      user.changeEmail(props.email);
    }

    if (props.name !== undefined) {
      user.changeName(props.name);
    }

    if (props.surname !== undefined) {
      user.changeSurname(props.surname);
    }

    if (props.password !== undefined) {
      const password = new Password(props.password);
      const passwordHash = await this.passwordHasher.hash(password);
      user.assignPasswordHash(passwordHash);
    }

    return this.userRepository.update(user);
  }
}
