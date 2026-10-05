import { GenerateEmbeddingUseCase } from 'src/application/ai/generate-embedding-use-case';
import { Event } from 'src/domain/event/event';
import type { EventRepository } from 'src/domain/event/event-repository';
import type {
  EventEmbeddingRecord,
  EventEmbeddingStore,
  SimilarEventHit,
  UpsertEventEmbeddingParams,
} from 'src/domain/ports/event-embedding-store';
import { FakeEmbeddingAdapter } from 'src/infrastructure/ai/fake-embedding.adapter';
import { hashEmbeddingContent } from 'src/application/ai/embedding-text';

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

class InMemoryEventEmbeddingStore implements EventEmbeddingStore {
  readonly rows = new Map<string, EventEmbeddingRecord & { vector: number[] }>();
  upsertCalls = 0;

  async findByEventId(
    eventId: string,
    userId: string,
  ): Promise<EventEmbeddingRecord | null> {
    const row = this.rows.get(eventId);
    if (!row || row.userId !== userId) {
      return null;
    }
    const { vector: _vector, ...record } = row;
    return record;
  }

  async upsert(params: UpsertEventEmbeddingParams): Promise<void> {
    this.upsertCalls += 1;
    this.rows.set(params.eventId, {
      eventId: params.eventId,
      userId: params.userId,
      model: params.model,
      dimensions: params.dimensions,
      contentHash: params.contentHash,
      embeddedAt: new Date(),
      vector: params.vector,
    });
  }

  async findSimilarByVector(): Promise<SimilarEventHit[]> {
    return [];
  }

  async findSimilarByEventId(): Promise<SimilarEventHit[]> {
    return [];
  }

  async findRecentBySharedTags(): Promise<SimilarEventHit[]> {
    return [];
  }

  async findRecentByDomain(): Promise<SimilarEventHit[]> {
    return [];
  }
}

describe('GenerateEmbeddingUseCase', () => {
  const logger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  it('embeds once and skips duplicate jobs with same content hash + model', async () => {
    const event = Event.create({
      userId: '11111111-1111-1111-1111-111111111111',
      sourceId: '22222222-2222-2222-2222-222222222222',
      eventType: 'WEB_VISIT',
      occurredAt: new Date('2026-06-01T00:00:00.000Z'),
      metadata: {
        title: 'Apache Kafka',
        url: 'https://kafka.apache.org',
      },
    });

    const repo = new InMemoryEventRepository();
    repo.seed(event);
    const store = new InMemoryEventEmbeddingStore();
    const embeddingPort = new FakeEmbeddingAdapter();
    const useCase = new GenerateEmbeddingUseCase(
      repo,
      embeddingPort,
      store,
      logger,
    );

    const first = await useCase.execute(event.getId().toString());
    const second = await useCase.execute(event.getId().toString());

    expect(first.status).toBe('embedded');
    expect(second.status).toBe('skipped');
    expect(embeddingPort.embedCalls).toBe(1);
    expect(store.upsertCalls).toBe(1);

    const text = 'Apache Kafka\nhttps://kafka.apache.org';
    expect(store.rows.get(event.getId().toString())?.contentHash).toBe(
      hashEmbeddingContent(text),
    );
  });
});
