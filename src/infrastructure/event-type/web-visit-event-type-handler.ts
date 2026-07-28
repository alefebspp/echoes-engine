import { Injectable } from '@nestjs/common';
import { EventTag } from 'src/domain/event-tag/event-tag';
import { categorizeUrl } from 'src/domain/event-tag/url-tag-categorizer';
import type { EventTypeHandler } from 'src/domain/ports/event-type-handler';

@Injectable()
export class WebVisitEventTypeHandler implements EventTypeHandler {
  readonly type = 'WEB_VISIT';

  suggestTags(metadata: Record<string, unknown>): EventTag[] {
    const url = metadata.url;
    if (typeof url !== 'string' || url.length === 0) {
      return [];
    }

    return categorizeUrl(url).map((match) => EventTag.fromUrlMatch(match));
  }
}
