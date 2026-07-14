import { Password } from '../value-objects/password';

export interface PasswordHasher {
  hash(password: Password): Promise<string>;

  compare(password: Password, hash: string): Promise<boolean>;
}
