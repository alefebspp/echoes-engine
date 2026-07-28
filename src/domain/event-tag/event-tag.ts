import { randomUUID } from 'node:crypto';
import { InvalidEventTagException } from '../exceptions/invalid-event-tag-exception';
import type { UrlTagMatch } from './url-tag-categorizer';

const MAX_TAG_LENGTH = 100;

export class EventTag {
  private constructor(
    private readonly id: string,
    private readonly tag: string,
    private readonly confidence: number | null,
    private readonly createdAt: Date,
  ) {}

  static create(props: {
    tag: string;
    confidence?: number | null;
  }): EventTag {
    return new EventTag(
      randomUUID(),
      EventTag.normalizeTag(props.tag),
      EventTag.normalizeConfidence(props.confidence ?? null),
      new Date(),
    );
  }

  static fromUrlMatch(match: UrlTagMatch): EventTag {
    return EventTag.create({
      tag: match.tag,
      confidence: match.confidence,
    });
  }

  static reconstitute(props: {
    id: string;
    tag: string;
    confidence: number | null;
    createdAt: Date;
  }): EventTag {
    if (!props.id) {
      throw new InvalidEventTagException('EventTag id cannot be empty.');
    }

    return new EventTag(
      props.id,
      EventTag.normalizeTag(props.tag),
      EventTag.normalizeConfidence(props.confidence),
      props.createdAt,
    );
  }

  getId(): string {
    return this.id;
  }

  getTag(): string {
    return this.tag;
  }

  getConfidence(): number | null {
    return this.confidence;
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  equals(other: EventTag): boolean {
    return this.id === other.id;
  }

  hasSameTag(other: EventTag): boolean {
    return this.tag === other.tag;
  }

  private static normalizeTag(raw: string): string {
    const tag = raw.trim().toLowerCase();

    if (!tag) {
      throw new InvalidEventTagException('EventTag name cannot be empty.');
    }

    if (tag.length > MAX_TAG_LENGTH) {
      throw new InvalidEventTagException(
        `EventTag name cannot exceed ${MAX_TAG_LENGTH} characters.`,
      );
    }

    return tag;
  }

  private static normalizeConfidence(
    confidence: number | null,
  ): number | null {
    if (confidence === null) {
      return null;
    }

    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      throw new InvalidEventTagException(
        'EventTag confidence must be between 0 and 1.',
      );
    }

    return confidence;
  }
}
