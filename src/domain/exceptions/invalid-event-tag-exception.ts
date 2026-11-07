import { ErrorCode } from 'src/common/errors/error-code';
import { DomainError } from 'src/domain/exceptions/domain-error';

export class InvalidEventTagException extends DomainError {
  readonly code = ErrorCode.INVALID_EVENT_TAG;

  constructor(message = 'Invalid event tag.') {
    super(message);
    this.name = 'InvalidEventTagException';
  }
}
