import { ErrorCode } from 'src/common/errors/error-code';
import { DomainError } from 'src/domain/exceptions/domain-error';

export class UnableToStoreEventException extends DomainError {
  readonly code = ErrorCode.UNABLE_TO_STORE_EVENT;

  constructor() {
    super('Unable to store event');
    this.name = 'UnableToStoreEventException';
  }
}
