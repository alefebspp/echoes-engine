import {
  ConsoleLogger,
  Inject,
  Injectable,
  LogLevel,
  Scope,
} from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { RequestContextStore } from '../async-context/request-context.store';
import { isStructuredLogEntry } from './structured-log';

@Injectable({ scope: Scope.TRANSIENT })
export class AppLogger extends ConsoleLogger {
  constructor(
    @Inject(AsyncLocalStorage)
    private readonly als: AsyncLocalStorage<RequestContextStore>,
  ) {
    super({ json: true });
  }

  protected getJsonLogObject(
    message: unknown,
    options: {
      context: string;
      logLevel: LogLevel;
      writeStreamType?: 'stdout' | 'stderr';
      errorStack?: unknown;
    },
  ) {
    const correlationId = this.als.getStore()?.correlationId;

    if (isStructuredLogEntry(message)) {
      const { message: logMessage, ...metadata } = message;

      return {
        level: options.logLevel,
        pid: process.pid,
        timestamp: Date.now(),
        ...metadata,
        message: logMessage,
        ...(correlationId ? { correlationId } : {}),
        ...(options.context ? { context: options.context } : {}),
        ...(options.errorStack ? { stack: options.errorStack } : {}),
      };
    }

    const logObject = super.getJsonLogObject(message, options);

    if (!correlationId) {
      return logObject;
    }

    return {
      ...logObject,
      correlationId,
    };
  }
}
