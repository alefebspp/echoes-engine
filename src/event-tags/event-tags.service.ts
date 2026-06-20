import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { EventTag } from './event-tag.entity';
import { categorizeUrl } from './url-tag-categorizer';

@Injectable()
export class EventTagsService {
  constructor(
    @InjectRepository(EventTag)
    private readonly eventTagsRepository: Repository<EventTag>,
  ) {}

  async tagEventFromMetadata(
    eventId: string,
    metadata: Record<string, unknown>,
    manager?: EntityManager,
  ): Promise<EventTag[]> {
    const url = metadata.url;
    if (typeof url !== 'string' || url.length === 0) {
      return [];
    }

    const matches = categorizeUrl(url);
    if (matches.length === 0) {
      return [];
    }

    const eventTagsRepository = manager
      ? manager.getRepository(EventTag)
      : this.eventTagsRepository;

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
