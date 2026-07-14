import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubmitEventUseCase } from 'src/application/event/submit-event-use-case';
import type { SubmitEventLogger } from 'src/application/event/submit-event-use-case';
import { AppLogger } from 'src/common/logging/app-logger.service';
import type { EventRepository } from 'src/domain/event/event-repository';
import type { EventSourceLookup } from 'src/domain/ports/event-source-lookup';
import { EventSourceSeeder } from 'src/infrastructure/event-sources/event-source-seeder';
import { TypeOrmEventSourceLookup } from 'src/infrastructure/event-sources/typeorm-event-source-lookup';
import {
  EVENT_REPOSITORY,
  EVENT_SOURCE_LOOKUP,
} from 'src/infrastructure/nest/injection-tokens';
import { EventOrmEntity } from 'src/infrastructure/typeorm/entities/event.entity';
import { EventSourceOrmEntity } from 'src/infrastructure/typeorm/entities/event-source.entity';
import { EventTagOrmEntity } from 'src/infrastructure/typeorm/entities/event-tag.entity';
import { TypeOrmEventRepository } from 'src/infrastructure/typeorm/event-repository';
import { TypeOrmEventTagger } from 'src/infrastructure/typeorm/event-tagger';
import { EventController } from './event.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventOrmEntity,
      EventSourceOrmEntity,
      EventTagOrmEntity,
    ]),
  ],
  controllers: [EventController],
  providers: [
    EventSourceSeeder,
    TypeOrmEventTagger,
    {
      provide: EVENT_SOURCE_LOOKUP,
      useClass: TypeOrmEventSourceLookup,
    },
    {
      provide: EVENT_REPOSITORY,
      useClass: TypeOrmEventRepository,
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
  exports: [EVENT_REPOSITORY, TypeOrmEventTagger],
})
export class EventModule {}
