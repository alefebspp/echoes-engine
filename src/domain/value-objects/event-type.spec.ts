import { InvalidEventTypeException } from '../exceptions/invalid-event-type-exception';
import { EventType } from './event-type';

describe('EventType', () => {
  it('creates WEB_VISIT', () => {
    const eventType = EventType.create('WEB_VISIT');

    expect(eventType.toString()).toBe('WEB_VISIT');
  });

  it('creates APP_VISIT', () => {
    const eventType = EventType.create('APP_VISIT');

    expect(eventType.toString()).toBe('APP_VISIT');
  });

  it('normalizes casing and trim', () => {
    const eventType = EventType.create('  web_visit  ');

    expect(eventType.toString()).toBe('WEB_VISIT');
  });

  it('rejects unknown types', () => {
    expect(() => EventType.create('SPOTIFY_PLAY')).toThrow(
      InvalidEventTypeException,
    );
  });

  it('compares equal values', () => {
    expect(EventType.create('WEB_VISIT').equals(EventType.create('WEB_VISIT'))).toBe(
      true,
    );
  });
});
