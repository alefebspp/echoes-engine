import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';
import { InvalidCredentialsException } from 'src/application/auth/exceptions/invalid-credentials-exception';
import { EventSourceNotFoundException } from 'src/application/event/exceptions/event-source-not-found-exception';
import { UnableToStoreEventException } from 'src/application/event/exceptions/unable-to-store-event-exception';
import { UserAlreadyExistsException } from 'src/application/user/exceptions/user-already-exists-exception';
import { UserNotFoundException } from 'src/application/user/exceptions/user-not-found-exception';
import { InvalidEmailException } from 'src/domain/exceptions/invalid-email-exception';
import { InvalidPasswordException } from 'src/domain/exceptions/invalid-password-exception';

@Catch(
  UserAlreadyExistsException,
  UserNotFoundException,
  InvalidPasswordException,
  InvalidEmailException,
  EventSourceNotFoundException,
  UnableToStoreEventException,
  InvalidCredentialsException,
)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof InvalidCredentialsException) {
      const httpException = new UnauthorizedException({
        error: 'Invalid credentials',
      });
      response
        .status(httpException.getStatus())
        .json(httpException.getResponse());
      return;
    }

    if (
      exception instanceof UserNotFoundException ||
      exception instanceof EventSourceNotFoundException
    ) {
      const httpException = new NotFoundException(exception.message);
      response
        .status(httpException.getStatus())
        .json(httpException.getResponse());
      return;
    }

    const httpException = new BadRequestException(exception.message);
    response
      .status(httpException.getStatus())
      .json(httpException.getResponse());
  }
}
