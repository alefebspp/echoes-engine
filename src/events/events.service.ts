import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    private readonly eventSourcesService: EventSourcesService,
    private readonly eventTagsService: EventTagsService,
  ) {}

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
      const event = this.eventsRepository.create({
        userId,
        sourceId: source.id,
        eventType: submitEventDto.type,
        occurredAt: new Date(submitEventDto.timestamp),
        metadata: { ...submitEventDto.metadata },
        externalEventId: submitEventDto.id ?? null,
      });

      const saved = await this.eventsRepository.save(event);
      await this.eventTagsService.tagEventFromMetadata(
        saved.id,
        saved.metadata,
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
