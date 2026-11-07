import { ErrorCode } from 'src/common/errors/error-code';
import { DomainError } from 'src/domain/exceptions/domain-error';

export class EventSourceNotFoundException extends DomainError {
  readonly code = ErrorCode.EVENT_SOURCE_NOT_FOUND;

  constructor(sourceCode: string) {
    super(`Event source ${sourceCode} not found`);
    this.name = 'EventSourceNotFoundException';
  }
}
