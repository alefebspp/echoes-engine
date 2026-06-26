import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventSource } from './event-source.entity';

const DEFAULT_EVENT_SOURCES: Pick<EventSource, 'code' | 'name'>[] = [
  { code: 'browser_extension', name: 'Browser Extension' },
  { code: 'mobile_sdk', name: 'Mobile SDK' },
  { code: 'github_connector', name: 'GitHub Connector' },
  { code: 'spotify_connector', name: 'Spotify Connector' },
  { code: 'manual_input', name: 'Manual Input' },
];

@Injectable()
export class EventSourcesService implements OnModuleInit {
  constructor(
    @InjectRepository(EventSource)
    private readonly eventSourcesRepository: Repository<EventSource>,
  ) {}

  async onModuleInit(): Promise<void> {
    for (const source of DEFAULT_EVENT_SOURCES) {
      const existing = await this.eventSourcesRepository.findOneBy({
        code: source.code,
      });
      if (!existing) {
        await this.eventSourcesRepository.save(
          this.eventSourcesRepository.create(source),
        );
      }
    }
  }

  findByCode(code: string): Promise<EventSource | null> {
    return this.eventSourcesRepository.findOneBy({ code });
  }
}
