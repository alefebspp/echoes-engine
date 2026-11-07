import { ErrorCode } from 'src/common/errors/error-code';
import { DomainError } from 'src/domain/exceptions/domain-error';

export class InvalidEmailException extends DomainError {
  readonly code = ErrorCode.INVALID_EMAIL;

  constructor() {
    super('Invalid email.');
    this.name = 'InvalidEmailException';
  }
}
