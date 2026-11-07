import { ErrorCode } from 'src/common/errors/error-code';
import { DomainError } from 'src/domain/exceptions/domain-error';

export class UnsupportedEventTypeHandlerException extends DomainError {
  readonly code = ErrorCode.UNSUPPORTED_EVENT_TYPE;

  constructor(eventType: string) {
    super(`No handler registered for event type: ${eventType}.`);
    this.name = 'UnsupportedEventTypeHandlerException';
  }
}
