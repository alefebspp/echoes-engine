import { Inject, Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { RequestContextStore } from 'src/common/async-context/request-context.store';
import type { CorrelationIdProvider } from 'src/domain/ports/correlation-id-provider';

@Injectable()
export class AlsCorrelationIdProvider implements CorrelationIdProvider {
  constructor(
    @Inject(AsyncLocalStorage)
    private readonly als: AsyncLocalStorage<RequestContextStore>,
  ) {}

  getCorrelationId(): string | null {
    return this.als.getStore()?.correlationId ?? null;
  }
}
