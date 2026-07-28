export class UnsupportedEventTypeHandlerException extends Error {
  constructor(eventType: string) {
    super(`No handler registered for event type: ${eventType}.`);
    this.name = 'UnsupportedEventTypeHandlerException';
  }
}
