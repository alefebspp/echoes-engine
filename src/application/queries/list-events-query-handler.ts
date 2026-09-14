import type { EventsListReadStore, ListEventsQuery } from 'src/domain/ports/events-list-read-store';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

export type ListEventsQueryInput = {
  userId: string;
  limit?: number;
  cursor?: { occurredAt: Date; id: string };
  from?: Date;
  to?: Date;
  tag?: string;
};

export class ListEventsQueryHandler {
  constructor(private readonly eventsListReadStore: EventsListReadStore) {}

  execute(input: ListEventsQueryInput) {
    const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

    const query: ListEventsQuery = {
      userId: input.userId,
      limit,
      cursor: input.cursor,
      from: input.from,
      to: input.to,
      tag: input.tag,
    };

    return this.eventsListReadStore.list(query);
  }
}
