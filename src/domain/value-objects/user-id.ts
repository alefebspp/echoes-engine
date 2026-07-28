import { randomUUID } from 'node:crypto';

export class UserId {
  private constructor(private readonly value: string) {}

  static generate(): UserId {
    return new UserId(randomUUID());
  }

  static from(value: string): UserId {
    if (!value) {
      throw new Error('UserId cannot be empty');
    }

    return new UserId(value);
  }

  equals(other: UserId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
