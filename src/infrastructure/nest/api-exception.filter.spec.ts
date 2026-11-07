import {
  ArgumentsHost,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { InvalidCredentialsException } from 'src/application/auth/exceptions/invalid-credentials-exception';
import { UnableToStoreEventException } from 'src/application/event/exceptions/unable-to-store-event-exception';
import { UserAlreadyExistsException } from 'src/application/user/exceptions/user-already-exists-exception';
import { UserNotFoundException } from 'src/application/user/exceptions/user-not-found-exception';
import { ErrorCode } from 'src/common/errors/error-code';
import { InvalidEmailException } from 'src/domain/exceptions/invalid-email-exception';
import { ApiExceptionFilter } from './api-exception.filter';

function run(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;

  new ApiExceptionFilter().catch(exception, host);

  return { status: status.mock.calls[0][0], body: json.mock.calls[0][0] };
}

describe('ApiExceptionFilter', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([
    [new InvalidEmailException(), 400, ErrorCode.INVALID_EMAIL],
    [new InvalidCredentialsException(), 401, ErrorCode.INVALID_CREDENTIALS],
    [new UserNotFoundException('abc'), 404, ErrorCode.USER_NOT_FOUND],
    [new UserAlreadyExistsException(), 409, ErrorCode.USER_ALREADY_EXISTS],
  ])('maps %p to its status and code', (exception, statusCode, code) => {
    const { status, body } = run(exception);

    expect(status).toBe(statusCode);
    expect(body).toEqual({ statusCode, code, message: exception.message });
  });

  it('hides the message of server-side domain errors', () => {
    const { status, body } = run(new UnableToStoreEventException());

    expect(status).toBe(500);
    expect(body).toEqual({
      statusCode: 500,
      code: ErrorCode.UNABLE_TO_STORE_EVENT,
      message: 'Internal server error',
    });
  });

  it('keeps a code set on an HttpException payload', () => {
    const { body } = run(
      new NotFoundException({
        code: ErrorCode.EVENT_NOT_FOUND,
        message: 'Event not found',
      }),
    );

    expect(body).toEqual({
      statusCode: 404,
      code: ErrorCode.EVENT_NOT_FOUND,
      message: 'Event not found',
    });
  });

  it('passes validation details through', () => {
    const details = [{ field: 'email', rules: ['isEmail'] }];
    const { body } = run(
      new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: ['email must be an email'],
        details,
      }),
    );

    expect(body).toEqual({
      statusCode: 400,
      code: ErrorCode.VALIDATION_FAILED,
      message: ['email must be an email'],
      details,
    });
  });

  it('derives a code from the status of framework exceptions', () => {
    expect(run(new UnauthorizedException()).body.code).toBe(
      ErrorCode.UNAUTHORIZED,
    );
    expect(run(new ThrottlerException()).body).toMatchObject({
      statusCode: 429,
      code: ErrorCode.RATE_LIMITED,
    });
  });

  it('turns unknown errors into an opaque 500', () => {
    const { status, body } = run(new Error('db password is hunter2'));

    expect(status).toBe(500);
    expect(body).toEqual({
      statusCode: 500,
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Internal server error',
    });
  });
});
