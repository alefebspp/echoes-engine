import { Global, Module } from '@nestjs/common';
import { AlsModule } from '../async-context/als.module';
import { AppLogger } from './app-logger.service';

@Global()
@Module({
  imports: [AlsModule],
  providers: [AppLogger],
  exports: [AppLogger],
})
export class LoggerModule {}
