import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AppLogger } from '../common/logging/app-logger.service';
import { structuredLog } from '../common/logging/structured-log';
import { EventSourcesService } from '../event-sources/event-sources.service';
import { EventTagsService } from '../event-tags/event-tags.service';
import { SubmitEventDto } from './dto/submit-event.dto';
import { Event } from './event.entity';

export type SubmitEventResult = {
  id: string;
  status: 'accepted';
};

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,
    private readonly dataSource: DataSource,
    private readonly eventSourcesService: EventSourcesService,
    private readonly eventTagsService: EventTagsService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(EventsService.name);
  }

  async submit(
    userId: string,
    submitEventDto: SubmitEventDto,
  ): Promise<SubmitEventResult> {
    const source = await this.eventSourcesService.findByCode(
      submitEventDto.source,
    );
    if (!source) {
      throw new NotFoundException(`Event source ${submitEventDto.source} not found`);
    }

    if (submitEventDto.id) {
      const existing = await this.eventsRepository.findOneBy({
        userId,
        externalEventId: submitEventDto.id,
      });
      if (existing) {
        return { id: existing.id, status: 'accepted' };
      }
    }

    try {
      this.logger.log(
        structuredLog('event.create.started', {
          userId,
          eventType: submitEventDto.type,
          source: submitEventDto.source,
          externalEventId: submitEventDto.id ?? null,
        }),
      );

      const saved = await this.dataSource.transaction(async (manager) => {
        const event = manager.create(Event, {
          userId,
          sourceId: source.id,
          eventType: submitEventDto.type,
          occurredAt: new Date(submitEventDto.timestamp),
          metadata: { ...submitEventDto.metadata },
          externalEventId: submitEventDto.id ?? null,
        });

        const persisted = await manager.save(event);
        await this.eventTagsService.tagEventFromMetadata(
          persisted.id,
          persisted.metadata,
          manager,
        );
        return persisted;
      });

      this.logger.log(
        structuredLog('event.create.succeeded', {
          userId,
          eventId: saved.id,
          eventType: submitEventDto.type,
          source: submitEventDto.source,
        }),
      );

      return { id: saved.id, status: 'accepted' };
    } catch (error) {
      if (
        submitEventDto.id &&
        this.isUniqueViolation(error)
      ) {
        const existing = await this.eventsRepository.findOneBy({
          userId,
          externalEventId: submitEventDto.id,
        });
        if (existing) {
          return { id: existing.id, status: 'accepted' };
        }
      }

      this.logger.error(
        structuredLog('event.create.failed', {
          userId,
          eventType: submitEventDto.type,
          source: submitEventDto.source,
          externalEventId: submitEventDto.id ?? null,
          ...(error instanceof Error && {
            errorName: error.name,
            errorMessage: error.message,
          }),
        }),
        error instanceof Error ? error.stack : undefined,
      );

      throw new BadRequestException('Unable to store event');
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === '23505'
    );
  }
}
