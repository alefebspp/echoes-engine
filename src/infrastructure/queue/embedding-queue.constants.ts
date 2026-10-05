export const EMBEDDING_QUEUE = 'embedding';
export const EMBEDDING_DLQ = 'embedding-dlq';

export const GENERATE_EMBEDDING_JOB = 'generate-embedding';
export const EMBEDDING_DEAD_LETTER_JOB = 'embedding-dead-letter';

export type GenerateEmbeddingJobPayload = {
  outboxMessageId: string;
  eventId: string;
  userId: string;
  eventType: string;
  correlationId: string | null;
  domainEventType: string;
};

export type EmbeddingDeadLetterPayload = GenerateEmbeddingJobPayload & {
  failedReason: string;
  attemptsMade: number;
};
