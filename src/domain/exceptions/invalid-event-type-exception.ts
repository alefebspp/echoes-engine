import { ErrorCode } from 'src/common/errors/error-code';
import { DomainError } from 'src/domain/exceptions/domain-error';

export class InvalidEventTypeException extends DomainError {
  readonly code = ErrorCode.INVALID_EVENT_TYPE;

  constructor(value?: string) {
    super(
      value
        ? `Invalid event type: ${value}.`
        : 'Invalid event type.',
    );
    this.name = 'InvalidEventTypeException';
  }
}
