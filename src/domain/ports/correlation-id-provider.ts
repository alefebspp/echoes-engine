export interface CorrelationIdProvider {
  getCorrelationId(): string | null;
}
