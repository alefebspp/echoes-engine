/**
 * Past-tense fact that occurred in the domain.
 * Handlers react; emitters must not call enrichment/HTTP from here.
 */
export interface DomainEvent {
  readonly type: string;
  readonly occurredAt: Date;
  toPayload(): Record<string, unknown>;
}
