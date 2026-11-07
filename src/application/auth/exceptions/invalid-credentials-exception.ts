import { ErrorCode } from 'src/common/errors/error-code';
import { DomainError } from 'src/domain/exceptions/domain-error';

export class InvalidCredentialsException extends DomainError {
  readonly code = ErrorCode.INVALID_CREDENTIALS;

  constructor() {
    super('Invalid credentials');
    this.name = 'InvalidCredentialsException';
  }
}
