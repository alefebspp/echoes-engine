import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventModule } from 'src/presentation/event/event.module';
import {
  ENRICHMENT_DLQ,
  ENRICHMENT_QUEUE,
} from './enrichment-queue.constants';
import { EnrichmentProcessor } from './enrichment.processor';
import { OutboxPublisher } from './outbox-publisher.service';
import { buildRedisConnection } from './redis-connection.config';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    EventModule,
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
  providers: [OutboxPublisher, EnrichmentProcessor],
  exports: [BullModule, OutboxPublisher],
})
export class EnrichmentQueueModule {}
