import { createHash } from 'crypto';

/**
 * Build the embedding text for an event from type + metadata.
 */
export function buildEventEmbeddingText(
  eventType: string,
  metadata: Record<string, unknown>,
): string | null {
  if (eventType === 'WEB_VISIT') {
    const title = typeof metadata.title === 'string' ? metadata.title.trim() : '';
    const url = typeof metadata.url === 'string' ? metadata.url.trim() : '';
    if (!title && !url) {
      return null;
    }
    return [title, url].filter((part) => part.length > 0).join('\n');
  }

  if (eventType === 'APP_VISIT') {
    const appName =
      typeof metadata.appName === 'string' ? metadata.appName.trim() : '';
    const title = typeof metadata.title === 'string' ? metadata.title.trim() : '';
    if (!appName && !title) {
      return null;
    }
    return [appName, title].filter((part) => part.length > 0).join('\n');
  }

  return null;
}

export function hashEmbeddingContent(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
