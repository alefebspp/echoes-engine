import { ErrorCode } from 'src/common/errors/error-code';
import { DomainError } from 'src/domain/exceptions/domain-error';

export class UserNotFoundException extends DomainError {
  readonly code = ErrorCode.USER_NOT_FOUND;

  constructor(id?: string) {
    super(id ? `User #${id} not found` : 'User not found');
    this.name = 'UserNotFoundException';
  }
}