import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { UpdateEventIngestProjectionsUseCase } from 'src/application/projection/update-event-ingest-projections-use-case';
import { UpdateTagStatsProjectionUseCase } from 'src/application/projection/update-tag-stats-projection-use-case';
import type { EventRepository } from 'src/domain/event/event-repository';
import type { ProjectionStore } from 'src/domain/ports/projection-store';
import { AppLogger } from 'src/common/logging/app-logger.service';
import {
  EVENT_REPOSITORY,
  PROJECTION_STORE,
} from 'src/infrastructure/nest/injection-tokens';
import { EventModule } from 'src/presentation/event/event.module';
import { ReadModelsModule } from 'src/presentation/read-models/read-models.module';
import {
  ENRICHMENT_DLQ,
  ENRICHMENT_QUEUE,
} from './enrichment-queue.constants';
import { EnrichmentProcessor } from './enrichment.processor';
import { OutboxPublisher } from './outbox-publisher.service';
import { WeeklyStatsRefreshService } from './weekly-stats-refresh.service';
import { buildRedisConnection } from './redis-connection.config';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    EventModule,
    ReadModelsModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: buildRedisConnection({
          REDIS_URL: configService.get<string>('REDIS_URL'),
          REDIS_HOST: configService.get<string>('REDIS_HOST'),
          REDIS_PORT: configService.get<string>('REDIS_PORT'),
          REDIS_PASSWORD: configService.get<string>('REDIS_PASSWORD'),
          REDIS_USERNAME: configService.get<string>('REDIS_USERNAME'),
          REDIS_TLS: configService.get<string>('REDIS_TLS'),
        }),
      }),
    }),
    BullModule.registerQueue(
      {
        name: ENRICHMENT_QUEUE,
      },
      {
        name: ENRICHMENT_DLQ,
      },
    ),
  ],
  providers: [
    OutboxPublisher,
    EnrichmentProcessor,
    WeeklyStatsRefreshService,
    {
      provide: UpdateEventIngestProjectionsUseCase,
      useFactory: (
        eventRepository: EventRepository,
        projectionStore: ProjectionStore,
        logger: AppLogger,
      ) => {
        logger.setContext(UpdateEventIngestProjectionsUseCase.name);
        return new UpdateEventIngestProjectionsUseCase(
          eventRepository,
          projectionStore,
          logger,
        );
      },
      inject: [EVENT_REPOSITORY, PROJECTION_STORE, AppLogger],
    },
    {
      provide: UpdateTagStatsProjectionUseCase,
      useFactory: (
        eventRepository: EventRepository,
        projectionStore: ProjectionStore,
        logger: AppLogger,
      ) => {
        logger.setContext(UpdateTagStatsProjectionUseCase.name);
        return new UpdateTagStatsProjectionUseCase(
          eventRepository,
          projectionStore,
          logger,
        );
      },
      inject: [EVENT_REPOSITORY, PROJECTION_STORE, AppLogger],
    },
  ],
  exports: [BullModule, OutboxPublisher],
})
export class EnrichmentQueueModule {}
