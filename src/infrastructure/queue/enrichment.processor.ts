import { InjectQueue, Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { EnrichEventTagsUseCase } from 'src/application/event/enrich-event-tags-use-case';
import { AppLogger } from 'src/common/logging/app-logger.service';
import { structuredLog } from 'src/common/logging/structured-log';
import {
  ENRICHMENT_DLQ,
  ENRICHMENT_DEAD_LETTER_JOB,
  ENRICHMENT_QUEUE,
  ENRICH_EVENT_JOB,
  type EnrichEventJobPayload,
  type EnrichmentDeadLetterPayload,
} from './enrichment-queue.constants';

@Processor(ENRICHMENT_QUEUE)
@Injectable()
export class EnrichmentProcessor extends WorkerHost {
  constructor(
    private readonly enrichEventTagsUseCase: EnrichEventTagsUseCase,
    @InjectQueue(ENRICHMENT_DLQ)
    private readonly deadLetterQueue: Queue<EnrichmentDeadLetterPayload>,
    private readonly logger: AppLogger,
  ) {
    super();
    this.logger.setContext(EnrichmentProcessor.name);
  }

  async process(job: Job<EnrichEventJobPayload>): Promise<void> {
    if (job.name !== ENRICH_EVENT_JOB) {
      this.logger.warn(
        structuredLog('enrichment.unknown_job', {
          jobId: job.id,
          jobName: job.name,
        }),
      );
      return;
    }

    const { eventId, correlationId, userId, outboxMessageId } = job.data;

    this.logger.log(
      structuredLog('enrichment.started', {
        jobId: job.id,
        eventId,
        userId,
        outboxMessageId,
        correlationId,
        attempt: job.attemptsMade + 1,
      }),
    );

    const result = await this.enrichEventTagsUseCase.execute(eventId);

    if (result.status === 'not_found') {
      // Event missing after ingest is a poison case — fail so retries/DLQ apply.
      throw new Error(`Event ${eventId} not found for enrichment`);
    }

    this.logger.log(
      structuredLog('enrichment.completed', {
        jobId: job.id,
        eventId,
        userId,
        correlationId,
        status: result.status,
        tagCount: result.tagCount,
      }),
    );
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<EnrichEventJobPayload> | undefined, error: Error): Promise<void> {
    if (!job) {
      return;
    }

    const maxAttempts = job.opts.attempts ?? 1;
    const exhausted = job.attemptsMade >= maxAttempts;

    this.logger.error(
      structuredLog('enrichment.failed', {
        jobId: job.id,
        eventId: job.data.eventId,
        userId: job.data.userId,
        correlationId: job.data.correlationId,
        attemptsMade: job.attemptsMade,
        maxAttempts,
        exhausted,
        errorName: error.name,
        errorMessage: error.message,
      }),
      error.stack,
    );

    if (!exhausted) {
      return;
    }

    await this.deadLetterQueue.add(
      ENRICHMENT_DEAD_LETTER_JOB,
      {
        ...job.data,
        failedReason: error.message,
        attemptsMade: job.attemptsMade,
      },
      {
        // BullMQ forbids `:` in custom job ids.
        jobId: `dlq-${job.data.outboxMessageId}`,
        removeOnComplete: false,
        removeOnFail: false,
      },
    );

    this.logger.error(
      structuredLog('enrichment.dead_lettered', {
        jobId: job.id,
        eventId: job.data.eventId,
        outboxMessageId: job.data.outboxMessageId,
        correlationId: job.data.correlationId,
        failedReason: error.message,
      }),
    );
  }
}
