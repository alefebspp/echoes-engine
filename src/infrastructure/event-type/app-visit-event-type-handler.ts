import { Injectable } from '@nestjs/common';
import { categorizeAppName } from 'src/domain/event-tag/app-name-tag-categorizer';
import { EventTag } from 'src/domain/event-tag/event-tag';
import type { EventTypeHandler } from 'src/domain/ports/event-type-handler';

@Injectable()
export class AppVisitEventTypeHandler implements EventTypeHandler {
  readonly type = 'APP_VISIT';

  suggestTags(metadata: Record<string, unknown>): EventTag[] {
    const appName = metadata.appName;
    if (typeof appName !== 'string' || appName.trim().length === 0) {
      return [];
    }

    return categorizeAppName(appName).map((match) =>
      EventTag.create({
        tag: match.tag,
        confidence: match.confidence,
      }),
    );
  }
}
