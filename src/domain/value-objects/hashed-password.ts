export class HashedPassword {
  constructor(private readonly value: string) {
    if (!value) {
      throw new Error('Hashed password cannot be empty');
    }
  }

  getValue(): string {
    return this.value;
  }
}
