import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ErrorCode,
  ErrorResponseBody,
  ValidationErrorDetail,
} from 'src/common/errors/error-code';
import { DomainError } from 'src/domain/exceptions/domain-error';

/** Domain codes that don't map to a plain 400. */
const DOMAIN_STATUS: Partial<Record<ErrorCode, HttpStatus>> = {
  [ErrorCode.INVALID_CREDENTIALS]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.USER_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.EVENT_SOURCE_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.EVENT_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.USER_ALREADY_EXISTS]: HttpStatus.CONFLICT,
  [ErrorCode.DUPLICATE_EXTERNAL_EVENT]: HttpStatus.CONFLICT,
  [ErrorCode.UNABLE_TO_STORE_EVENT]: HttpStatus.INTERNAL_SERVER_ERROR,
};

/** Codes for HTTP exceptions raised by Nest itself (guards, pipes, throttler). */
const STATUS_CODE: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.BAD_REQUEST,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCode.CONFLICT,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.RATE_LIMITED,
};

function codeForStatus(status: number): ErrorCode {
  return (
    STATUS_CODE[status] ??
    (status >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.BAD_REQUEST)
  );
}

function isErrorCode(value: unknown): value is ErrorCode {
  return (
    typeof value === 'string' &&
    (Object.values(ErrorCode) as string[]).includes(value)
  );
}

/**
 * Shapes every error response as `{ statusCode, code, message, details? }` so
 * clients can branch on `code` instead of parsing English messages.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);

    if (body.statusCode >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.message : String(exception),
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ErrorResponseBody {
    if (exception instanceof DomainError) {
      const statusCode = DOMAIN_STATUS[exception.code] ?? HttpStatus.BAD_REQUEST;
      return {
        statusCode,
        code: exception.code,
        message:
          statusCode >= 500 ? 'Internal server error' : exception.message,
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const raw = exception.getResponse();
      const payload =
        typeof raw === 'object' && raw !== null
          ? (raw as Record<string, unknown>)
          : {};
      const message = payload.message;

      return {
        statusCode,
        code: isErrorCode(payload.code)
          ? payload.code
          : codeForStatus(statusCode),
        message:
          typeof message === 'string' || Array.isArray(message)
            ? (message as string | string[])
            : exception.message,
        ...(Array.isArray(payload.details)
          ? { details: payload.details as ValidationErrorDetail[] }
          : {}),
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Internal server error',
    };
  }
}
