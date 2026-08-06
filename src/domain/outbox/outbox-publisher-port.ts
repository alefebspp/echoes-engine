import type { OutboxMessage } from './outbox-message';

/**
 * Claims unpublished outbox rows and marks them published after broker accept.
 */
export interface OutboxStore {
  claimUnpublished(limit: number): Promise<OutboxMessage[]>;
  markPublished(ids: string[], publishedAt?: Date): Promise<void>;
}
