import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { GenerateEmbeddingUseCase } from 'src/application/ai/generate-embedding-use-case';
import { AppLogger } from 'src/common/logging/app-logger.service';
import { structuredLog } from 'src/common/logging/structured-log';
import {
  EMBEDDING_DEAD_LETTER_JOB,
  EMBEDDING_DLQ,
  EMBEDDING_QUEUE,
  GENERATE_EMBEDDING_JOB,
  type EmbeddingDeadLetterPayload,
  type GenerateEmbeddingJobPayload,
} from './embedding-queue.constants';

@Processor(EMBEDDING_QUEUE)
@Injectable()
export class EmbeddingProcessor extends WorkerHost {
  constructor(
    private readonly generateEmbeddingUseCase: GenerateEmbeddingUseCase,
    @InjectQueue(EMBEDDING_DLQ)
    private readonly deadLetterQueue: Queue<EmbeddingDeadLetterPayload>,
    private readonly logger: AppLogger,
  ) {
    super();
    this.logger.setContext(EmbeddingProcessor.name);
  }

  async process(job: Job<GenerateEmbeddingJobPayload>): Promise<void> {
    if (job.name !== GENERATE_EMBEDDING_JOB) {
      this.logger.warn(
        structuredLog('embedding.unknown_job', {
          jobId: job.id,
          jobName: job.name,
        }),
      );
      return;
    }

    const { eventId, correlationId, userId, outboxMessageId } = job.data;

    this.logger.log(
      structuredLog('embedding.started', {
        jobId: job.id,
        eventId,
        userId,
        outboxMessageId,
        correlationId,
        attempt: job.attemptsMade + 1,
      }),
    );

    const result = await this.generateEmbeddingUseCase.execute(eventId);

    if (result.status === 'not_found') {
      throw new Error(`Event ${eventId} not found for embedding`);
    }

    this.logger.log(
      structuredLog('embedding.completed', {
        jobId: job.id,
        eventId,
        userId,
        correlationId,
        status: result.status,
        model: result.model ?? null,
      }),
    );
  }

  @OnWorkerEvent('failed')
  async onFailed(
    job: Job<GenerateEmbeddingJobPayload> | undefined,
    error: Error,
  ): Promise<void> {
    if (!job) {
      return;
    }

    const maxAttempts = job.opts.attempts ?? 1;
    const exhausted = job.attemptsMade >= maxAttempts;

    this.logger.error(
      structuredLog('embedding.failed', {
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
      EMBEDDING_DEAD_LETTER_JOB,
      {
        ...job.data,
        failedReason: error.message,
        attemptsMade: job.attemptsMade,
      },
      {
        jobId: `dlq-embed-${job.data.outboxMessageId}`,
        removeOnComplete: false,
        removeOnFail: false,
      },
    );

    this.logger.error(
      structuredLog('embedding.dead_lettered', {
        jobId: job.id,
        eventId: job.data.eventId,
        outboxMessageId: job.data.outboxMessageId,
        correlationId: job.data.correlationId,
        failedReason: error.message,
      }),
    );
  }
}
