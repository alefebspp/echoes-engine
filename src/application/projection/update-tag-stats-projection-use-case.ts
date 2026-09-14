import { structuredLog } from 'src/common/logging/structured-log';
import type { EventRepository } from 'src/domain/event/event-repository';
import type { ProjectionStore } from 'src/domain/ports/projection-store';

export type UpdateTagStatsProjectionLogger = {
  log(message: unknown): void;
  warn(message: unknown): void;
};

export type UpdateTagStatsProjectionResult = {
  eventId: string;
  status: 'applied' | 'skipped' | 'not_found' | 'no_tags';
};

/**
 * Idempotent tag rollup projection updater — runs after enrichment.
 */
export class UpdateTagStatsProjectionUseCase {
  constructor(
    private readonly eventRepository: EventRepository,
    private readonly projectionStore: ProjectionStore,
    private readonly logger: UpdateTagStatsProjectionLogger,
  ) {}

  async execute(eventId: string): Promise<UpdateTagStatsProjectionResult> {
    const event = await this.eventRepository.findById(eventId);

    if (!event) {
      this.logger.warn(
        structuredLog('projection.tags.not_found', { eventId }),
      );
      return { eventId, status: 'not_found' };
    }

    const tags = event.getTags().map((tag) => tag.getTag());
    if (tags.length === 0) {
      return { eventId, status: 'no_tags' };
    }

    const status = await this.projectionStore.applyTagProjection({
      eventId,
      userId: event.getUserId().toString(),
      tags,
    });

    this.logger.log(
      structuredLog('projection.tags.completed', {
        eventId,
        userId: event.getUserId().toString(),
        status,
        tagCount: tags.length,
      }),
    );

    return { eventId, status };
  }
}
