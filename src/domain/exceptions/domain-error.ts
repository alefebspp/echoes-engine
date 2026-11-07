import type { ErrorCode } from 'src/common/errors/error-code';

/**
 * Base for business-rule failures. The code travels to the client unchanged;
 * the HTTP status is decided in the presentation layer.
 */
export abstract class DomainError extends Error {
  abstract readonly code: ErrorCode;
}
