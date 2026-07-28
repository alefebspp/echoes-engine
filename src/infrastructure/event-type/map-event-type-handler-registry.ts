import { UnsupportedEventTypeHandlerException } from 'src/domain/exceptions/unsupported-event-type-handler-exception';
import type { EventTypeHandler } from 'src/domain/ports/event-type-handler';
import type { EventTypeHandlerRegistry } from 'src/domain/ports/event-type-handler-registry';

export class MapEventTypeHandlerRegistry implements EventTypeHandlerRegistry {
  private readonly handlers: Map<string, EventTypeHandler>;

  constructor(handlers: EventTypeHandler[]) {
    this.handlers = new Map(
      handlers.map((handler) => [handler.type, handler]),
    );
  }

  getHandler(eventType: string): EventTypeHandler {
    const handler = this.handlers.get(eventType);
    if (!handler) {
      throw new UnsupportedEventTypeHandlerException(eventType);
    }

    return handler;
  }
}
