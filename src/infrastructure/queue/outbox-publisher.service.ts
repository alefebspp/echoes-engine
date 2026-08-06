import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { AppLogger } from 'src/common/logging/app-logger.service';
import { structuredLog } from 'src/common/logging/structured-log';
import { EventIngested } from 'src/domain/domain-event/event-ingested';
import type { OutboxStore } from 'src/domain/outbox/outbox-publisher-port';
import { OUTBOX_STORE } from 'src/infrastructure/nest/injection-tokens';
import {
  ENRICHMENT_QUEUE,
  ENRICH_EVENT_JOB,
  type EnrichEventJobPayload,
} from './enrichment-queue.constants';

@Injectable()
export class OutboxPublisher implements OnModuleDestroy {
  private readonly batchSize: number;
  private readonly enabled: boolean;
  private publishing = false;
  private stopped = false;

  constructor(
    @Inject(OUTBOX_STORE)
    private readonly outboxStore: OutboxStore & {
      countUnpublished?: () => Promise<number>;
    },
    @InjectQueue(ENRICHMENT_QUEUE)
    private readonly enrichmentQueue: Queue<EnrichEventJobPayload>,
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(OutboxPublisher.name);
    this.batchSize = parseInt(
      this.configService.get<string>('OUTBOX_BATCH_SIZE', '50'),
      10,
    );
    this.enabled =
      this.configService.get<string>('OUTBOX_PUBLISHER_ENABLED', 'true') !==
      'false';
  }

  onModuleDestroy(): void {
    this.stopped = true;
  }

  @Interval(2000)
  async handleInterval(): Promise<void> {
    if (!this.enabled || this.stopped) {
      return;
    }
    await this.publishPending();
  }

  /**
   * Publishes unpublished outbox rows to BullMQ.
   * Safe to call from tests / manual triggers.
   */
  async publishPending(): Promise<number> {
    if (this.publishing || this.stopped) {
      return 0;
    }

    this.publishing = true;
    let publishedCount = 0;

    try {
      const messages = await this.outboxStore.claimUnpublished(this.batchSize);
      if (messages.length === 0) {
        return 0;
      }

      const publishedIds: string[] = [];

      for (const message of messages) {
        if (message.getType() !== EventIngested.TYPE) {
          this.logger.warn(
            structuredLog('outbox.unknown_type', {
              outboxMessageId: message.getId(),
              type: message.getType(),
            }),
          );
          publishedIds.push(message.getId());
          continue;
        }

        const payload = message.getPayload() as EnrichEventJobPayload & {
          eventId: string;
          userId: string;
          eventType: string;
          correlationId: string | null;
        };

        const jobPayload: EnrichEventJobPayload = {
          outboxMessageId: message.getId(),
          eventId: payload.eventId,
          userId: payload.userId,
          eventType: payload.eventType,
          correlationId: payload.correlationId ?? null,
          domainEventType: message.getType(),
        };

        await this.enrichmentQueue.add(ENRICH_EVENT_JOB, jobPayload, {
          // BullMQ forbids `:` in custom job ids.
          jobId: `outbox-${message.getId()}`,
          attempts: parseInt(
            this.configService.get<string>('ENRICHMENT_JOB_ATTEMPTS', '5'),
            10,
          ),
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: 1000,
          removeOnFail: false,
        });

        publishedIds.push(message.getId());
        publishedCount += 1;

        this.logger.log(
          structuredLog('outbox.published', {
            outboxMessageId: message.getId(),
            eventId: jobPayload.eventId,
            correlationId: jobPayload.correlationId,
            queue: ENRICHMENT_QUEUE,
          }),
        );
      }

      await this.outboxStore.markPublished(publishedIds);
      await this.logQueueDepth();
    } catch (error) {
      this.logger.error(
        structuredLog('outbox.publish.failed', {
          ...(error instanceof Error && {
            errorName: error.name,
            errorMessage: error.message,
          }),
        }),
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.publishing = false;
    }

    return publishedCount;
  }

  private async logQueueDepth(): Promise<void> {
    try {
      const [waiting, active, delayed, failed] = await Promise.all([
        this.enrichmentQueue.getWaitingCount(),
        this.enrichmentQueue.getActiveCount(),
        this.enrichmentQueue.getDelayedCount(),
        this.enrichmentQueue.getFailedCount(),
      ]);
      const unpublished =
        (await this.outboxStore.countUnpublished?.()) ?? undefined;

      this.logger.log(
        structuredLog('queue.depth', {
          queue: ENRICHMENT_QUEUE,
          waiting,
          active,
          delayed,
          failed,
          outboxUnpublished: unpublished ?? null,
        }),
      );
    } catch {
      // metrics are best-effort
    }
  }
}
