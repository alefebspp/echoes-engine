export type EventCursorPayload = {
  occurredAt: string;
  id: string;
};

export class InvalidEventCursorException extends Error {
  constructor() {
    super('Invalid cursor');
    this.name = 'InvalidEventCursorException';
  }
}

export function encodeEventCursor(payload: EventCursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeEventCursor(encoded: string): EventCursorPayload {
  try {
    const decoded = Buffer.from(encoded, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as EventCursorPayload;

    if (
      typeof parsed.occurredAt !== 'string' ||
      typeof parsed.id !== 'string' ||
      parsed.occurredAt.length === 0 ||
      parsed.id.length === 0
    ) {
      throw new InvalidEventCursorException();
    }

    return parsed;
  } catch (error) {
    if (error instanceof InvalidEventCursorException) {
      throw error;
    }

    throw new InvalidEventCursorException();
  }
}

export function formatDateInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function extractHourInTimezone(date: Date, timezone: string): number {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  }).format(date);

  return parseInt(hour, 10);
}

export function computeStreak(activeDates: string[], timezone: string): number {
  if (activeDates.length === 0) {
    return 0;
  }

  const today = formatDateInTimezone(new Date(), timezone);
  const yesterday = formatDateInTimezone(
    new Date(Date.now() - 86_400_000),
    timezone,
  );

  const mostRecent = activeDates[0];
  if (mostRecent !== today && mostRecent !== yesterday) {
    return 0;
  }

  let streak = 1;
  for (let index = 1; index < activeDates.length; index += 1) {
    const previous = activeDates[index - 1];
    const current = activeDates[index];
    const previousDate = new Date(`${previous}T00:00:00Z`);
    const currentDate = new Date(`${current}T00:00:00Z`);
    const diffMs = previousDate.getTime() - currentDate.getTime();
    if (diffMs !== 86_400_000) {
      break;
    }
    streak += 1;
  }

  return streak;
}
