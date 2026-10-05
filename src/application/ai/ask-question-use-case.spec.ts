import { AskQuestionUseCase } from 'src/application/ai/ask-question-use-case';
import type {
  EventEmbeddingRecord,
  EventEmbeddingStore,
  SimilarEventHit,
  UpsertEventEmbeddingParams,
} from 'src/domain/ports/event-embedding-store';
import { FakeEmbeddingAdapter } from 'src/infrastructure/ai/fake-embedding.adapter';
import { FakeLlmAdapter } from 'src/infrastructure/ai/fake-llm.adapter';

class ControllableEmbeddingStore implements EventEmbeddingStore {
  hits: SimilarEventHit[] = [];

  async findByEventId(): Promise<EventEmbeddingRecord | null> {
    return null;
  }

  async upsert(_params: UpsertEventEmbeddingParams): Promise<void> {}

  async findSimilarByVector(): Promise<SimilarEventHit[]> {
    return this.hits;
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

describe('AskQuestionUseCase', () => {
  const logger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  it('refuses without calling the LLM when retrieval is empty', async () => {
    const embeddingPort = new FakeEmbeddingAdapter();
    const llmPort = new FakeLlmAdapter();
    const store = new ControllableEmbeddingStore();
    store.hits = [];

    const useCase = new AskQuestionUseCase(
      embeddingPort,
      llmPort,
      store,
      logger,
      { limit: 8, minSimilarity: 0.25 },
    );

    const result = await useCase.execute({
      userId: '11111111-1111-1111-1111-111111111111',
      question: 'What did I read about queues?',
    });

    expect(result.refused).toBe(true);
    expect(result.mode).toBe('refused');
    expect(result.retrievedCount).toBe(0);
    expect(llmPort.generateCalls).toBe(0);
  });

  it('returns snippets_only when the LLM fails after retrieval', async () => {
    const embeddingPort = new FakeEmbeddingAdapter();
    const llmPort = new FakeLlmAdapter();
    llmPort.failNext = true;
    const store = new ControllableEmbeddingStore();
    store.hits = [
      {
        eventId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        userId: '11111111-1111-1111-1111-111111111111',
        similarity: 0.9,
        occurredAt: new Date('2026-06-01T00:00:00.000Z'),
        eventType: 'WEB_VISIT',
        metadata: {
          title: 'Kafka',
          url: 'https://kafka.apache.org',
        },
        tags: ['developer-tools'],
      },
    ];

    const useCase = new AskQuestionUseCase(
      embeddingPort,
      llmPort,
      store,
      logger,
      { limit: 8, minSimilarity: 0.25 },
    );

    const result = await useCase.execute({
      userId: '11111111-1111-1111-1111-111111111111',
      question: 'What did I read about queues?',
    });

    expect(result.mode).toBe('snippets_only');
    expect(result.refused).toBe(false);
    expect(result.retrievedCount).toBe(1);
    expect(result.citations[0]?.eventId).toBe(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    );
  });
});
