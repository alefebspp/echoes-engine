import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import { Event } from 'src/domain/event/event';
import type { EventRepository } from 'src/domain/event/event-repository';
import { EventTag } from 'src/domain/event-tag/event-tag';
import { DuplicateExternalEventException } from 'src/domain/exceptions/duplicate-external-event-exception';
import { OutboxMessage } from 'src/domain/outbox/outbox-message';
import type { OutboxStore } from 'src/domain/outbox/outbox-publisher-port';
import { EventOrmEntity } from './entities/event.entity';
import { EventTagOrmEntity } from './entities/event-tag.entity';
import { OutboxMessageOrmEntity } from './entities/outbox-message.entity';
import { EventMapper } from './event-mapper';

@Injectable()
export class TypeOrmEventRepository implements EventRepository, OutboxStore {
  constructor(
    @InjectRepository(EventOrmEntity)
    private readonly events: Repository<EventOrmEntity>,
    @InjectRepository(OutboxMessageOrmEntity)
    private readonly outbox: Repository<OutboxMessageOrmEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async findById(id: string): Promise<Event | null> {
    const entity = await this.events.findOne({
      where: { id },
      relations: { tags: true },
    });
    return entity ? EventMapper.toDomain(entity) : null;
  }

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

  async create(
    event: Event,
    outboxMessages: OutboxMessage[] = [],
  ): Promise<Event> {
    try {
      const saved = await this.dataSource.transaction(async (manager) => {
        const entity = EventMapper.toOrm(event);
        const persisted = await manager.save(entity);

        if (outboxMessages.length > 0) {
          const outboxRepo = manager.getRepository(OutboxMessageOrmEntity);
          await outboxRepo.save(
            outboxMessages.map((message) => this.toOutboxOrm(message)),
          );
        }

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

  async persistAssignedTags(event: Event): Promise<Event> {
    const saved = await this.dataSource.transaction(async (manager) => {
      const eventsRepo = manager.getRepository(EventOrmEntity);
      // Lock the event row alone — Postgres rejects FOR UPDATE on the
      // nullable side of an outer join (tags via LEFT JOIN).
      const existing = await eventsRepo.findOne({
        where: { id: event.getId().toString() },
        lock: { mode: 'pessimistic_write' },
      });

      if (!existing) {
        throw new Error(`Event ${event.getId().toString()} not found`);
      }

      if (existing.tagsAssigned) {
        existing.tags = await manager.getRepository(EventTagOrmEntity).find({
          where: { eventId: existing.id },
        });
        return existing;
      }

      existing.tagsAssigned = true;
      await eventsRepo.save(existing);
      existing.tags = await this.persistTags(
        existing.id,
        event.getTags(),
        manager,
      );
      return existing;
    });

    return EventMapper.toDomain(saved);
  }

  async claimUnpublished(limit: number): Promise<OutboxMessage[]> {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager
        .getRepository(OutboxMessageOrmEntity)
        .createQueryBuilder('outbox')
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .where('outbox.published_at IS NULL')
        .orderBy('outbox.created_at', 'ASC')
        .take(limit)
        .getMany();

      return rows.map((row) => this.toOutboxDomain(row));
    });
  }

  async markPublished(ids: string[], publishedAt: Date = new Date()): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    await this.outbox.update({ id: In(ids) }, { publishedAt });
  }

  async countUnpublished(): Promise<number> {
    return this.outbox.count({ where: { publishedAt: IsNull() } });
  }

  private persistTags(
    eventId: string,
    tags: EventTag[],
    manager: EntityManager,
  ): Promise<EventTagOrmEntity[]> {
    if (tags.length === 0) {
      return Promise.resolve([]);
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

  private toOutboxOrm(message: OutboxMessage): OutboxMessageOrmEntity {
    const entity = new OutboxMessageOrmEntity();
    entity.id = message.getId();
    entity.type = message.getType();
    entity.payload = message.getPayload();
    entity.createdAt = message.getCreatedAt();
    entity.publishedAt = message.getPublishedAt();
    return entity;
  }

  private toOutboxDomain(entity: OutboxMessageOrmEntity): OutboxMessage {
    return OutboxMessage.reconstitute({
      id: entity.id,
      type: entity.type,
      payload: entity.payload,
      createdAt: entity.createdAt,
      publishedAt: entity.publishedAt,
    });
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
