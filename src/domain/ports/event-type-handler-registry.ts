import type { EventTypeHandler } from './event-type-handler';

export interface EventTypeHandlerRegistry {
  getHandler(eventType: string): EventTypeHandler;
}
