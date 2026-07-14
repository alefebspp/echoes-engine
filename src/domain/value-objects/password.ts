import { InvalidPasswordException } from '../exceptions/invalid-password-exception';

export class Password {
  constructor(private readonly value: string) {
    if (value.length < 8) {
      throw new InvalidPasswordException();
    }
  }

  getValue() {
    return this.value;
  }
}
