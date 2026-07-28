import { InvalidEventTypeException } from '../exceptions/invalid-event-type-exception';

const ALLOWED_EVENT_TYPES = ['WEB_VISIT', 'APP_VISIT'] as const;

export type AllowedEventType = (typeof ALLOWED_EVENT_TYPES)[number];

export class EventType {
  private constructor(private readonly value: AllowedEventType) {}

  static create(raw: string): EventType {
    const normalized = raw.trim().toUpperCase();

    if (!EventType.isAllowed(normalized)) {
      throw new InvalidEventTypeException(raw);
    }

    return new EventType(normalized);
  }

  static isAllowed(value: string): value is AllowedEventType {
    return (ALLOWED_EVENT_TYPES as readonly string[]).includes(value);
  }

  equals(other: EventType): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
