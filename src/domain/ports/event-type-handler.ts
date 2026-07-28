import type { EventTag } from '../event-tag/event-tag';

/**
 * Strategy for one event type: type-specific enrichment (and later validation).
 * Register implementations in EventTypeHandlerRegistry — do not switch on type in the use case.
 */
export interface EventTypeHandler {
  readonly type: string;
  suggestTags(metadata: Record<string, unknown>): EventTag[];
}
