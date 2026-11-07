import { ErrorCode } from 'src/common/errors/error-code';
import { DomainError } from 'src/domain/exceptions/domain-error';

export class UserAlreadyExistsException extends DomainError {
  readonly code = ErrorCode.USER_ALREADY_EXISTS;

  constructor() {
    super('Email already registered');
    this.name = 'UserAlreadyExistsException';
  }
}
