import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Event } from 'src/domain/event/event';
import type { EventRepository } from 'src/domain/event/event-repository';
import { EventTag } from 'src/domain/event-tag/event-tag';
import { DuplicateExternalEventException } from 'src/domain/exceptions/duplicate-external-event-exception';
import { EventOrmEntity } from './entities/event.entity';
import { EventTagOrmEntity } from './entities/event-tag.entity';
import { EventMapper } from './event-mapper';

@Injectable()
export class TypeOrmEventRepository implements EventRepository {
  constructor(
    @InjectRepository(EventOrmEntity)
    private readonly events: Repository<EventOrmEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async findByUserIdAndExternalEventId(
    userId: string,
    externalEventId: string,
  ): Promise<Event | null> {
    const entity = await this.events.findOne({
      where: { userId, externalEventId },
      relations: { tags: true },
    });
    return entity ? EventMapper.toDomain(entity) : null;
  }

  async create(event: Event): Promise<Event> {
    try {
      const saved = await this.dataSource.transaction(async (manager) => {
        const entity = EventMapper.toOrm(event);
        const persisted = await manager.save(entity);
        persisted.tags = await this.persistTags(
          persisted.id,
          event.getTags(),
          manager,
        );
        return persisted;
      });

      return EventMapper.toDomain(saved);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new DuplicateExternalEventException();
      }
      throw error;
    }
  }

  private async persistTags(
    eventId: string,
    tags: EventTag[],
    manager: EntityManager,
  ): Promise<EventTagOrmEntity[]> {
    if (tags.length === 0) {
      return [];
    }

    const eventTagsRepository = manager.getRepository(EventTagOrmEntity);
    const entities = tags.map((tag) => {
      const confidence = tag.getConfidence();
      return eventTagsRepository.create({
        id: tag.getId(),
        eventId,
        tag: tag.getTag(),
        confidence: confidence === null ? null : confidence.toFixed(4),
        createdAt: tag.getCreatedAt(),
      });
    });

    return eventTagsRepository.save(entities);
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
