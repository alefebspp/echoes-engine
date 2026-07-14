import { Injectable } from '@nestjs/common';
import type { EventSourceLookup } from 'src/domain/ports/event-source-lookup';
import { EventSourcesService } from 'src/event-sources/event-sources.service';

@Injectable()
export class EventSourcesLookupAdapter implements EventSourceLookup {
  constructor(private readonly eventSourcesService: EventSourcesService) {}

  async findIdByCode(code: string): Promise<string | null> {
    const source = await this.eventSourcesService.findByCode(code);
    return source?.id ?? null;
  }
}
