import { structuredLog } from 'src/common/logging/structured-log';
import type { EmbeddingPort } from 'src/domain/ports/embedding-port';
import type {
  EventEmbeddingStore,
  RetrievalFilters,
  SimilarEventHit,
} from 'src/domain/ports/event-embedding-store';
import type { LLMPort } from 'src/domain/ports/llm-port';

export type AskQuestionLogger = {
  log(message: unknown): void;
  warn(message: unknown): void;
  error(message: unknown, stack?: string): void;
};

export type AskQuestionInput = {
  userId: string;
  question: string;
  limit?: number;
  from?: Date;
  to?: Date;
  tags?: string[];
  minSimilarity?: number;
};

export type AskCitation = {
  eventId: string;
  title: string | null;
  url: string | null;
  occurredAt: string;
};

export type AskQuestionResult = {
  answer: string | null;
  citations: AskCitation[];
  snippets: Array<{
    eventId: string;
    title: string | null;
    url: string | null;
    occurredAt: string;
    similarity: number;
  }>;
  retrievedCount: number;
  refused: boolean;
  mode: 'answer' | 'refused' | 'snippets_only';
  refusalReason?: string;
};

/**
 * RAG query use case: retrieve → augment → generate (or refuse / snippets-only).
 */
export class AskQuestionUseCase {
  constructor(
    private readonly embeddingPort: EmbeddingPort,
    private readonly llmPort: LLMPort,
    private readonly eventEmbeddingStore: EventEmbeddingStore,
    private readonly logger: AskQuestionLogger,
    private readonly defaults: {
      limit: number;
      minSimilarity: number;
    },
  ) {}

  async execute(input: AskQuestionInput): Promise<AskQuestionResult> {
    const question = input.question.trim();
    const limit = Math.min(
      Math.max(input.limit ?? this.defaults.limit, 1),
      20,
    );
    const minSimilarity = input.minSimilarity ?? this.defaults.minSimilarity;

    const filters: RetrievalFilters = {
      from: input.from,
      to: input.to,
      tags: input.tags,
    };

    const embedded = await this.embeddingPort.embed(question);
    const hits = await this.eventEmbeddingStore.findSimilarByVector({
      userId: input.userId,
      vector: embedded.vector,
      model: embedded.model,
      limit,
      filters,
      minSimilarity,
    });

    if (hits.length === 0) {
      this.logger.log(
        structuredLog('ai.ask.refused', {
          userId: input.userId,
          reason: 'no_retrieval_hits',
          hasFilters: Boolean(filters.from || filters.to || filters.tags?.length),
        }),
      );
      return {
        answer: null,
        citations: [],
        snippets: [],
        retrievedCount: 0,
        refused: true,
        mode: 'refused',
        refusalReason:
          filters.from || filters.to || filters.tags?.length
            ? 'No matching events for the given filters.'
            : 'No relevant events found for this question.',
      };
    }

    const citations = hits.map((hit) => this.toCitation(hit));
    const snippets = hits.map((hit) => ({
      eventId: hit.eventId,
      title: this.stringMeta(hit.metadata, 'title'),
      url: this.stringMeta(hit.metadata, 'url'),
      occurredAt: hit.occurredAt.toISOString(),
      similarity: hit.similarity,
    }));

    const systemPrompt = [
      "You are an assistant answering questions about the user's browsing history.",
      'Use ONLY the sources below. If the sources do not contain enough information, say you cannot answer.',
      'Cite source numbers like [1] or [2]. Do not invent URLs or pages not listed.',
    ].join(' ');

    const sourceLines = hits.map((hit, index) => {
      const title = this.stringMeta(hit.metadata, 'title') ?? '(untitled)';
      const url = this.stringMeta(hit.metadata, 'url') ?? '';
      const tags =
        hit.tags.length > 0 ? ` tags=${hit.tags.join(',')}` : '';
      return `[${index + 1}] event_id=${hit.eventId} occurred_at=${hit.occurredAt.toISOString()} title="${title}" url=${url}${tags}`;
    });

    const userPrompt = [
      'Sources:',
      ...sourceLines,
      '',
      `Question: ${question}`,
      '',
      'Instructions:',
      '- Cite source numbers like [1] or [2].',
      '- Do not invent URLs or pages not listed above.',
    ].join('\n');

    try {
      const generated = await this.llmPort.generate({
        systemPrompt,
        userPrompt,
        maxTokens: 500,
      });

      this.logger.log(
        structuredLog('ai.ask.answered', {
          userId: input.userId,
          retrievedCount: hits.length,
        }),
      );

      return {
        answer: generated.text,
        citations,
        snippets,
        retrievedCount: hits.length,
        refused: false,
        mode: 'answer',
      };
    } catch (error) {
      this.logger.error(
        structuredLog('ai.ask.llm_failed', {
          userId: input.userId,
          retrievedCount: hits.length,
          ...(error instanceof Error && {
            errorName: error.name,
            errorMessage: error.message,
          }),
        }),
        error instanceof Error ? error.stack : undefined,
      );

      return {
        answer: `Found ${hits.length} related page(s); generation unavailable.`,
        citations,
        snippets,
        retrievedCount: hits.length,
        refused: false,
        mode: 'snippets_only',
      };
    }
  }

  private toCitation(hit: SimilarEventHit): AskCitation {
    return {
      eventId: hit.eventId,
      title: this.stringMeta(hit.metadata, 'title'),
      url: this.stringMeta(hit.metadata, 'url'),
      occurredAt: hit.occurredAt.toISOString(),
    };
  }

  private stringMeta(
    metadata: Record<string, unknown>,
    key: string,
  ): string | null {
    const value = metadata[key];
    return typeof value === 'string' && value.trim().length > 0
      ? value
      : null;
  }
}
