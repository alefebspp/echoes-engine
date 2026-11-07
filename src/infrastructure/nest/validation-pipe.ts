import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import {
  ErrorCode,
  ValidationErrorDetail,
} from 'src/common/errors/error-code';

function flatten(
  errors: ValidationError[],
  parent?: string,
): ValidationErrorDetail[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own: ValidationErrorDetail[] = error.constraints
      ? [{ field, rules: Object.keys(error.constraints) }]
      : [];
    return [...own, ...flatten(error.children ?? [], field)];
  });
}

function messages(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...messages(error.children ?? []),
  ]);
}

/** The app-wide pipe; rejections carry `VALIDATION_FAILED` plus per-field details. */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) =>
      new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: messages(errors),
        details: flatten(errors),
      }),
  });
}
