import { randomUUID } from 'node:crypto';

export class EventId {
  private constructor(private readonly value: string) {}

  static generate(): EventId {
    return new EventId(randomUUID());
  }

  static from(value: string): EventId {
    if (!value) {
      throw new Error('EventId cannot be empty');
    }

    return new EventId(value);
  }

  equals(other: EventId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
