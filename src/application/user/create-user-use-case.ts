import { UserAlreadyExistsException } from './exceptions/user-already-exists-exception';
import { User } from 'src/domain/user/user';
import type { UserRepository } from 'src/domain/user/user-repository';
import type { PasswordHasher } from 'src/domain/ports/password-hasher';
import { Password } from 'src/domain/value-objects/password';

export class CreateUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(props: {
    name: string;
    surname: string;
    email: string;
    password: string;
  }): Promise<User> {
    const existing = await this.userRepository.findByEmail(props.email);

    if (existing) {
      throw new UserAlreadyExistsException();
    }

    const password = new Password(props.password);
    const passwordHash = await this.passwordHasher.hash(password);

    const user = User.create({
      name: props.name,
      surname: props.surname,
      email: props.email,
      passwordHash,
    });

    return this.userRepository.create(user);
  }
}
