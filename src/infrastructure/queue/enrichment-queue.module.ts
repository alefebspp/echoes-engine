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

@Module({
  imports: [
    ScheduleModule.forRoot(),
    EventModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: parseInt(configService.get<string>('REDIS_PORT', '6379'), 10),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
        },
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
