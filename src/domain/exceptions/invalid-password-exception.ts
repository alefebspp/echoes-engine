import { ErrorCode } from 'src/common/errors/error-code';
import { DomainError } from 'src/domain/exceptions/domain-error';

export class InvalidPasswordException extends DomainError {
  readonly code = ErrorCode.INVALID_PASSWORD;

  constructor() {
    super('Invalid password. Password must be at least 8 characters long.');
    this.name = 'InvalidPasswordException';
  }
}
