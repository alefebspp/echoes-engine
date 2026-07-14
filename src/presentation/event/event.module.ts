import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubmitEventUseCase } from 'src/application/event/submit-event-use-case';
import type { SubmitEventLogger } from 'src/application/event/submit-event-use-case';
import { AppLogger } from 'src/common/logging/app-logger.service';
import type { EventRepository } from 'src/domain/event/event-repository';
import type { EventSourceLookup } from 'src/domain/ports/event-source-lookup';
import { EventSourcesModule } from 'src/event-sources/event-sources.module';
import { EventTagsModule } from 'src/event-tags/event-tags.module';
import { EventSourcesLookupAdapter } from 'src/infrastructure/event-sources/event-sources-lookup.adapter';
import {
  EVENT_REPOSITORY,
  EVENT_SOURCE_LOOKUP,
} from 'src/infrastructure/nest/injection-tokens';
import { EventOrmEntity } from 'src/infrastructure/typeorm/entities/event.entity';
import { TypeOrmEventRepository } from 'src/infrastructure/typeorm/event-repository';
import { EventController } from './event.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([EventOrmEntity]),
    EventSourcesModule,
    EventTagsModule,
  ],
  controllers: [EventController],
  providers: [
    {
      provide: EVENT_REPOSITORY,
      useClass: TypeOrmEventRepository,
    },
    {
      provide: EVENT_SOURCE_LOOKUP,
      useClass: EventSourcesLookupAdapter,
    },
    {
      provide: SubmitEventUseCase,
      useFactory: (
        eventRepository: EventRepository,
        eventSourceLookup: EventSourceLookup,
        logger: AppLogger,
      ) => {
        logger.setContext(SubmitEventUseCase.name);
        return new SubmitEventUseCase(
          eventRepository,
          eventSourceLookup,
          logger as SubmitEventLogger,
        );
      },
      inject: [EVENT_REPOSITORY, EVENT_SOURCE_LOOKUP, AppLogger],
    },
  ],
  exports: [EVENT_REPOSITORY],
})
export class EventModule {}
