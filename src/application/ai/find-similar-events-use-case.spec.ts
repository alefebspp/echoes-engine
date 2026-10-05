import { FindSimilarEventsUseCase } from 'src/application/ai/find-similar-events-use-case';
import { Event } from 'src/domain/event/event';
import { EventTag } from 'src/domain/event-tag/event-tag';
import type { EventRepository } from 'src/domain/event/event-repository';
import type {
  EventEmbeddingRecord,
  EventEmbeddingStore,
  SimilarEventHit,
  UpsertEventEmbeddingParams,
} from 'src/domain/ports/event-embedding-store';

class InMemoryEventRepository implements EventRepository {
  constructor(private readonly events = new Map<string, Event>()) {}

  seed(event: Event): void {
    this.events.set(event.getId().toString(), event);
  }

  async findById(id: string): Promise<Event | null> {
    return this.events.get(id) ?? null;
  }

  async findByUserIdAndExternalEventId(): Promise<Event | null> {
    return null;
  }

  async create(event: Event): Promise<Event> {
    this.seed(event);
    return event;
  }

  async persistAssignedTags(event: Event): Promise<Event> {
    this.seed(event);
    return event;
  }
}

class TenantAwareEmbeddingStore implements EventEmbeddingStore {
  constructor(
    private readonly embeddings = new Map<string, EventEmbeddingRecord>(),
    private readonly similarByUser = new Map<string, SimilarEventHit[]>(),
  ) {}

  putEmbedding(record: EventEmbeddingRecord): void {
    this.embeddings.set(record.eventId, record);
  }

  putSimilar(userId: string, hits: SimilarEventHit[]): void {
    this.similarByUser.set(userId, hits);
  }

  async findByEventId(
    eventId: string,
    userId: string,
  ): Promise<EventEmbeddingRecord | null> {
    const row = this.embeddings.get(eventId);
    if (!row || row.userId !== userId) {
      return null;
    }
    return row;
  }

  async upsert(_params: UpsertEventEmbeddingParams): Promise<void> {}

  async findSimilarByVector(params: {
    userId: string;
  }): Promise<SimilarEventHit[]> {
    return (this.similarByUser.get(params.userId) ?? []).filter(
      (hit) => hit.userId === params.userId,
    );
  }

  async findSimilarByEventId(params: {
    userId: string;
    eventId: string;
  }): Promise<SimilarEventHit[]> {
    return (this.similarByUser.get(params.userId) ?? []).filter(
      (hit) => hit.userId === params.userId && hit.eventId !== params.eventId,
    );
  }

  async findRecentBySharedTags(): Promise<SimilarEventHit[]> {
    return [];
  }

  async findRecentByDomain(): Promise<SimilarEventHit[]> {
    return [];
  }
}

describe('FindSimilarEventsUseCase tenant isolation', () => {
  it('never returns another user event even if store were poisoned', async () => {
    const userA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const userB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const sourceId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

    const eventA = Event.create({
      userId: userA,
      sourceId,
      eventType: 'WEB_VISIT',
      occurredAt: new Date('2026-06-01T00:00:00.000Z'),
      metadata: { title: 'Kafka', url: 'https://kafka.apache.org' },
    });
    eventA.assignTags([EventTag.create({ tag: 'developer-tools' })]);

    const repo = new InMemoryEventRepository();
    repo.seed(eventA);

    const store = new TenantAwareEmbeddingStore();
    store.putEmbedding({
      eventId: eventA.getId().toString(),
      userId: userA,
      model: 'fake',
      dimensions: 1536,
      contentHash: 'abc',
      embeddedAt: new Date(),
    });
    store.putSimilar(userA, [
      {
        eventId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        userId: userA,
        similarity: 0.9,
        occurredAt: new Date('2026-06-02T00:00:00.000Z'),
        eventType: 'WEB_VISIT',
        metadata: { title: 'RabbitMQ', url: 'https://www.rabbitmq.com' },
        tags: ['developer-tools'],
      },
      {
        eventId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        userId: userB,
        similarity: 0.99,
        occurredAt: new Date('2026-06-03T00:00:00.000Z'),
        eventType: 'WEB_VISIT',
        metadata: { title: 'Secret', url: 'https://evil.example' },
        tags: [],
      },
    ]);

    const useCase = new FindSimilarEventsUseCase(repo, store, {
      log: jest.fn(),
      warn: jest.fn(),
    });

    const result = await useCase.execute({
      userId: userA,
      eventId: eventA.getId().toString(),
      limit: 10,
    });

    expect(result?.mode).toBe('vector');
    expect(result?.items.every((item) => item.eventId !== 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')).toBe(
      true,
    );
    expect(result?.items).toHaveLength(1);
    expect(result?.items[0]?.eventId).toBe(
      'dddddddd-dddd-dddd-dddd-dddddddddddd',
    );
  });

  it('returns null when the event belongs to another user', async () => {
    const event = Event.create({
      userId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      sourceId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      eventType: 'WEB_VISIT',
      occurredAt: new Date(),
      metadata: { title: 'Kafka', url: 'https://kafka.apache.org' },
    });
    const repo = new InMemoryEventRepository();
    repo.seed(event);
    const useCase = new FindSimilarEventsUseCase(
      repo,
      new TenantAwareEmbeddingStore(),
      { log: jest.fn(), warn: jest.fn() },
    );

    const result = await useCase.execute({
      userId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      eventId: event.getId().toString(),
    });

    expect(result).toBeNull();
  });
});
