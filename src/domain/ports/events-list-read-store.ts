export type EventListItemDto = {
  id: string;
  type: string;
  occurredAt: string;
  source: string;
  metadata: Record<string, unknown>;
  tags: string[];
};

export type ListEventsQuery = {
  userId: string;
  limit: number;
  cursor?: { occurredAt: Date; id: string };
  from?: Date;
  to?: Date;
  tag?: string;
};

export type ListEventsResult = {
  items: EventListItemDto[];
  nextCursor: string | null;
};

export interface EventsListReadStore {
  list(query: ListEventsQuery): Promise<ListEventsResult>;
}
