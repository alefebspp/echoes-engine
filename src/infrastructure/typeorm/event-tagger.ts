import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { categorizeUrl } from 'src/domain/event-tag/url-tag-categorizer';
import { EventTagOrmEntity } from './entities/event-tag.entity';

@Injectable()
export class TypeOrmEventTagger {
  constructor(
    @InjectRepository(EventTagOrmEntity)
    private readonly eventTags: Repository<EventTagOrmEntity>,
  ) {}

  async tagEventFromMetadata(
    eventId: string,
    metadata: Record<string, unknown>,
    manager?: EntityManager,
  ): Promise<EventTagOrmEntity[]> {
    const url = metadata.url;
    if (typeof url !== 'string' || url.length === 0) {
      return [];
    }

    const matches = categorizeUrl(url);
    if (matches.length === 0) {
      return [];
    }

    const eventTagsRepository = manager
      ? manager.getRepository(EventTagOrmEntity)
      : this.eventTags;

    const tags = matches.map((match) =>
      eventTagsRepository.create({
        eventId,
        tag: match.tag,
        confidence: match.confidence.toFixed(4),
      }),
    );

    return eventTagsRepository.save(tags);
  }
}
