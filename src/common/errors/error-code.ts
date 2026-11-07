/**
 * Stable, machine-readable error codes returned in every error response as
 * `code`. Clients translate these; `message` is an English fallback only.
 * Never rename or reuse a code — add a new one instead.
 */
export const ErrorCode = {
  // Generic, derived from the HTTP status.
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  // Auth and users.
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_PASSWORD: 'INVALID_PASSWORD',

  // Events.
  INVALID_EVENT_TYPE: 'INVALID_EVENT_TYPE',
  INVALID_EVENT_TAG: 'INVALID_EVENT_TAG',
  UNSUPPORTED_EVENT_TYPE: 'UNSUPPORTED_EVENT_TYPE',
  EVENT_SOURCE_NOT_FOUND: 'EVENT_SOURCE_NOT_FOUND',
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
  DUPLICATE_EXTERNAL_EVENT: 'DUPLICATE_EXTERNAL_EVENT',
  UNABLE_TO_STORE_EVENT: 'UNABLE_TO_STORE_EVENT',
  INVALID_CURSOR: 'INVALID_CURSOR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** One rejected field from request validation. */
export interface ValidationErrorDetail {
  /** Dotted path to the field, e.g. `metadata.url`. */
  field: string;
  /** class-validator constraint names, e.g. `maxLength`, `isEmail`. */
  rules: string[];
}

/** The body of every error response. */
export interface ErrorResponseBody {
  statusCode: number;
  code: ErrorCode;
  message: string | string[];
  details?: ValidationErrorDetail[];
}
