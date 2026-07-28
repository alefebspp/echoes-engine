import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventSourceOrmEntity } from '../typeorm/entities/event-source.entity';

const DEFAULT_EVENT_SOURCES: Pick<EventSourceOrmEntity, 'code' | 'name'>[] = [
  { code: 'browser_extension', name: 'Browser Extension' },
  { code: 'mobile_sdk', name: 'Mobile SDK' },
  { code: 'github_connector', name: 'GitHub Connector' },
  { code: 'spotify_connector', name: 'Spotify Connector' },
  { code: 'manual_input', name: 'Manual Input' },
];

@Injectable()
export class EventSourceSeeder implements OnModuleInit {
  constructor(
    @InjectRepository(EventSourceOrmEntity)
    private readonly eventSources: Repository<EventSourceOrmEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    for (const source of DEFAULT_EVENT_SOURCES) {
      const existing = await this.eventSources.findOneBy({
        code: source.code,
      });
      if (!existing) {
        await this.eventSources.save(this.eventSources.create(source));
      }
    }
  }
}
