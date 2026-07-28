import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { EventSourceLookup } from 'src/domain/ports/event-source-lookup';
import { EventSourceOrmEntity } from '../typeorm/entities/event-source.entity';

@Injectable()
export class TypeOrmEventSourceLookup implements EventSourceLookup {
  constructor(
    @InjectRepository(EventSourceOrmEntity)
    private readonly eventSources: Repository<EventSourceOrmEntity>,
  ) {}

  async findIdByCode(code: string): Promise<string | null> {
    const source = await this.eventSources.findOneBy({ code });
    return source?.id ?? null;
  }
}
