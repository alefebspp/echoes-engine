import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { PasswordHasher } from 'src/domain/ports/password-hasher';
import { Password } from 'src/domain/value-objects/password';

@Injectable()
export class BcryptPasswordHasher implements PasswordHasher {
  async hash(password: Password): Promise<string> {
    return bcrypt.hash(password.getValue(), 12);
  }

  async compare(password: Password, hash: string): Promise<boolean> {
    return bcrypt.compare(password.getValue(), hash);
  }
}
