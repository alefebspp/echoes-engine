import { Email } from '../value-objects/email';
import { HashedPassword } from '../value-objects/hashed-password';
import { UserId } from '../value-objects/user-id';

export class User {
  private constructor(
    private readonly id: UserId,
    private name: string,
    private surname: string,
    private email: Email,
    private passwordHash: HashedPassword,
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {}

  static create(props: {
    name: string;
    surname: string;
    email: string;
    passwordHash: string;
  }): User {
    const now = new Date();

    return new User(
      UserId.generate(),
      props.name,
      props.surname,
      Email.create(props.email),
      new HashedPassword(props.passwordHash),
      now,
      now,
    );
  }

  static reconstitute(props: {
    id: string;
    name: string;
    surname: string;
    email: string;
    passwordHash: string;
    createdAt: Date;
    updatedAt: Date;
  }): User {
    return new User(
      UserId.from(props.id),
      props.name,
      props.surname,
      Email.create(props.email),
      new HashedPassword(props.passwordHash),
      props.createdAt,
      props.updatedAt,
    );
  }

  changeName(name: string): void {
    this.name = name;
    this.touch();
  }

  changeSurname(surname: string): void {
    this.surname = surname;
    this.touch();
  }

  changeEmail(email: string): void {
    this.email = Email.create(email);
    this.touch();
  }

  assignPasswordHash(passwordHash: string): void {
    this.passwordHash = new HashedPassword(passwordHash);
    this.touch();
  }

  getId(): UserId {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getSurname(): string {
    return this.surname;
  }

  getEmail(): Email {
    return this.email;
  }

  getPasswordHash(): string {
    return this.passwordHash.getValue();
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  getUpdatedAt(): Date {
    return this.updatedAt;
  }

  private touch(): void {
    this.updatedAt = new Date();
  }
}
