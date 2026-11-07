import { ErrorCode } from 'src/common/errors/error-code';
import { DomainError } from 'src/domain/exceptions/domain-error';

export class DuplicateExternalEventException extends DomainError {
  readonly code = ErrorCode.DUPLICATE_EXTERNAL_EVENT;

  constructor() {
    super('Event with this external id already exists');
    this.name = 'DuplicateExternalEventException';
  }
}
