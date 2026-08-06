import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnrichEventTagsUseCase } from 'src/application/event/enrich-event-tags-use-case';
import type { EnrichEventTagsLogger } from 'src/application/event/enrich-event-tags-use-case';
import { SubmitEventUseCase } from 'src/application/event/submit-event-use-case';
import type { SubmitEventLogger } from 'src/application/event/submit-event-use-case';
import { AppLogger } from 'src/common/logging/app-logger.service';
import type { EventRepository } from 'src/domain/event/event-repository';
import type { CorrelationIdProvider } from 'src/domain/ports/correlation-id-provider';
import type { EventTypeHandlerRegistry } from 'src/domain/ports/event-type-handler-registry';
import type { EventSourceLookup } from 'src/domain/ports/event-source-lookup';
import { AlsCorrelationIdProvider } from 'src/infrastructure/async-context/als-correlation-id-provider';
import { AppVisitEventTypeHandler } from 'src/infrastructure/event-type/app-visit-event-type-handler';
import { MapEventTypeHandlerRegistry } from 'src/infrastructure/event-type/map-event-type-handler-registry';
import { WebVisitEventTypeHandler } from 'src/infrastructure/event-type/web-visit-event-type-handler';
import { EventSourceSeeder } from 'src/infrastructure/event-sources/event-source-seeder';
import { TypeOrmEventSourceLookup } from 'src/infrastructure/event-sources/typeorm-event-source-lookup';
import {
  CORRELATION_ID_PROVIDER,
  EVENT_REPOSITORY,
  EVENT_SOURCE_LOOKUP,
  EVENT_TYPE_HANDLER_REGISTRY,
  OUTBOX_STORE,
} from 'src/infrastructure/nest/injection-tokens';
import { EventOrmEntity } from 'src/infrastructure/typeorm/entities/event.entity';
import { EventSourceOrmEntity } from 'src/infrastructure/typeorm/entities/event-source.entity';
import { EventTagOrmEntity } from 'src/infrastructure/typeorm/entities/event-tag.entity';
import { OutboxMessageOrmEntity } from 'src/infrastructure/typeorm/entities/outbox-message.entity';
import { TypeOrmEventRepository } from 'src/infrastructure/typeorm/event-repository';
import { EventController } from './event.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventOrmEntity,
      EventSourceOrmEntity,
      EventTagOrmEntity,
      OutboxMessageOrmEntity,
    ]),
  ],
  controllers: [EventController],
  providers: [
    EventSourceSeeder,
    WebVisitEventTypeHandler,
    AppVisitEventTypeHandler,
    TypeOrmEventRepository,
    {
      provide: EVENT_SOURCE_LOOKUP,
      useClass: TypeOrmEventSourceLookup,
    },
    {
      provide: EVENT_TYPE_HANDLER_REGISTRY,
      useFactory: (
        webVisitHandler: WebVisitEventTypeHandler,
        appVisitHandler: AppVisitEventTypeHandler,
      ) =>
        new MapEventTypeHandlerRegistry([webVisitHandler, appVisitHandler]),
      inject: [WebVisitEventTypeHandler, AppVisitEventTypeHandler],
    },
    {
      provide: EVENT_REPOSITORY,
      useExisting: TypeOrmEventRepository,
    },
    {
      provide: OUTBOX_STORE,
      useExisting: TypeOrmEventRepository,
    },
    {
      provide: CORRELATION_ID_PROVIDER,
      useClass: AlsCorrelationIdProvider,
    },
    {
      provide: SubmitEventUseCase,
      useFactory: (
        eventRepository: EventRepository,
        eventSourceLookup: EventSourceLookup,
        eventTypeHandlerRegistry: EventTypeHandlerRegistry,
        correlationIdProvider: CorrelationIdProvider,
        logger: AppLogger,
      ) => {
        logger.setContext(SubmitEventUseCase.name);
        return new SubmitEventUseCase(
          eventRepository,
          eventSourceLookup,
          eventTypeHandlerRegistry,
          correlationIdProvider,
          logger as SubmitEventLogger,
        );
      },
      inject: [
        EVENT_REPOSITORY,
        EVENT_SOURCE_LOOKUP,
        EVENT_TYPE_HANDLER_REGISTRY,
        CORRELATION_ID_PROVIDER,
        AppLogger,
      ],
    },
    {
      provide: EnrichEventTagsUseCase,
      useFactory: (
        eventRepository: EventRepository,
        eventTypeHandlerRegistry: EventTypeHandlerRegistry,
        logger: AppLogger,
      ) => {
        logger.setContext(EnrichEventTagsUseCase.name);
        return new EnrichEventTagsUseCase(
          eventRepository,
          eventTypeHandlerRegistry,
          logger as EnrichEventTagsLogger,
        );
      },
      inject: [EVENT_REPOSITORY, EVENT_TYPE_HANDLER_REGISTRY, AppLogger],
    },
  ],
  exports: [
    EVENT_REPOSITORY,
    OUTBOX_STORE,
    EVENT_TYPE_HANDLER_REGISTRY,
    EnrichEventTagsUseCase,
    TypeOrmEventRepository,
  ],
})
export class EventModule {}
