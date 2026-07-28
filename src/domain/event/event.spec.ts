import { EventTag } from '../event-tag/event-tag';
import { InvalidEventTypeException } from '../exceptions/invalid-event-type-exception';
import { Event } from './event';

describe('Event', () => {
  const baseProps = {
    userId: '550e8400-e29b-41d4-a716-446655440000',
    sourceId: '660e8400-e29b-41d4-a716-446655440001',
    eventType: 'WEB_VISIT',
    occurredAt: new Date('2026-06-12T15:30:00.000Z'),
  };

  it('creates with a valid event type', () => {
    const event = Event.create({
      ...baseProps,
      metadata: { url: 'https://github.com/nestjs/nest' },
    });

    expect(event.getEventType()).toBe('WEB_VISIT');
  });

  it('rejects create with an invalid event type', () => {
    expect(() =>
      Event.create({
        ...baseProps,
        eventType: 'UNKNOWN_TYPE',
        metadata: {},
      }),
    ).toThrow(InvalidEventTypeException);
  });

  it('sets event type through the aggregate', () => {
    const event = Event.create({
      ...baseProps,
      metadata: {},
    });

    event.setEventType('web_visit');

    expect(event.getEventType()).toBe('WEB_VISIT');
  });

  it('rejects setEventType with an invalid value', () => {
    const event = Event.create({
      ...baseProps,
      metadata: {},
    });

    expect(() => event.setEventType('SPOTIFY_PLAY')).toThrow(
      InvalidEventTypeException,
    );
  });

  it('lists empty tags before they are assigned', () => {
    const event = Event.create({
      ...baseProps,
      metadata: { url: 'https://github.com/nestjs/nest' },
    });

    expect(event.getTags()).toEqual([]);
  });

  it('assigns enrichment tags once', () => {
    const event = Event.create({
      ...baseProps,
      metadata: { url: 'https://www.youtube.com/watch?v=1' },
    });
    const suggested = [
      EventTag.create({ tag: 'social media', confidence: 0.95 }),
    ];

    const tags = event.assignTags(suggested);

    expect(tags).toHaveLength(1);
    expect(tags[0].getTag()).toBe('social media');
    expect(tags[0].getConfidence()).toBe(0.95);
    expect(event.getTags()).toEqual(tags);
  });

  it('does not reassign tags on subsequent calls', () => {
    const event = Event.create({
      ...baseProps,
      metadata: { url: 'https://github.com/nestjs/nest' },
    });
    const firstSuggested = [
      EventTag.create({ tag: 'developer tools', confidence: 0.9 }),
    ];
    const secondSuggested = [
      EventTag.create({ tag: 'social media', confidence: 0.95 }),
    ];

    const first = event.assignTags(firstSuggested);
    const second = event.assignTags(secondSuggested);

    expect(second).toHaveLength(1);
    expect(second[0].getId()).toBe(first[0].getId());
    expect(second[0].getTag()).toBe('developer tools');
  });

  it('can assign an empty tag list', () => {
    const event = Event.create({
      ...baseProps,
      metadata: { title: 'No URL' },
    });

    expect(event.assignTags([])).toEqual([]);
    expect(event.getTags()).toEqual([]);
  });
});
