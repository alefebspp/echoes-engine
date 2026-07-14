import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Event } from 'src/domain/event/event';
import type { EventRepository } from 'src/domain/event/event-repository';
import { DuplicateExternalEventException } from 'src/domain/exceptions/duplicate-external-event-exception';
import { EventOrmEntity } from './entities/event.entity';
import { EventMapper } from './event-mapper';
import { TypeOrmEventTagger } from './event-tagger';

@Injectable()
export class TypeOrmEventRepository implements EventRepository {
  constructor(
    @InjectRepository(EventOrmEntity)
    private readonly events: Repository<EventOrmEntity>,
    private readonly dataSource: DataSource,
    private readonly eventTagger: TypeOrmEventTagger,
  ) {}

  async findByUserIdAndExternalEventId(
    userId: string,
    externalEventId: string,
  ): Promise<Event | null> {
    const entity = await this.events.findOneBy({
      userId,
      externalEventId,
    });
    return entity ? EventMapper.toDomain(entity) : null;
  }

  async create(event: Event): Promise<Event> {
    try {
      const saved = await this.dataSource.transaction(async (manager) => {
        const entity = EventMapper.toOrm(event);
        const persisted = await manager.save(entity);
        await this.eventTagger.tagEventFromMetadata(
          persisted.id,
          persisted.metadata,
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

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === '23505'
    );
  }
}
