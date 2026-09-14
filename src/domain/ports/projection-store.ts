export type IngestProjectionInput = {
  eventId: string;
  userId: string;
  sourceId: string;
  occurredAt: Date;
  localDate: string;
  localHour: number;
  domain: string | null;
  browser: string | null;
};

export type TagProjectionInput = {
  eventId: string;
  userId: string;
  tags: string[];
};

export interface ProjectionStore {
  resolveTimezone(userId: string): Promise<string>;
  applyIngestProjection(input: IngestProjectionInput): Promise<'applied' | 'skipped'>;
  applyTagProjection(input: TagProjectionInput): Promise<'applied' | 'skipped'>;
}
