export const ENRICHMENT_QUEUE = 'enrichment';
export const ENRICHMENT_DLQ = 'enrichment-dlq';

export const ENRICH_EVENT_JOB = 'enrich-event';
export const ENRICHMENT_DEAD_LETTER_JOB = 'enrichment-dead-letter';

export type EnrichEventJobPayload = {
  outboxMessageId: string;
  eventId: string;
  userId: string;
  eventType: string;
  correlationId: string | null;
  domainEventType: string;
};

export type EnrichmentDeadLetterPayload = EnrichEventJobPayload & {
  failedReason: string;
  attemptsMade: number;
};
