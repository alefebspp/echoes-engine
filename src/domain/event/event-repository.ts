import { Event } from './event';

export interface EventRepository {
  findByUserIdAndExternalEventId(
    userId: string,
    externalEventId: string,
  ): Promise<Event | null>;
  create(event: Event): Promise<Event>;
}
