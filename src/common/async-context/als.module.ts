import { Global, Module } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { RequestContextStore } from './request-context.store';

@Global()
@Module({
  providers: [
    {
      provide: AsyncLocalStorage,
      useValue: new AsyncLocalStorage<RequestContextStore>(),
    },
  ],
  exports: [AsyncLocalStorage],
})
export class AlsModule {}
