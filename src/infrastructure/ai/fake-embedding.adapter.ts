import { createHash } from 'crypto';
import type {
  EmbedResult,
  EmbeddingPort,
} from 'src/domain/ports/embedding-port';

/**
 * Deterministic fake embedding for unit/e2e tests (no network).
 * Token-hashed bags of words so overlapping phrases rank as similar.
 */
export class FakeEmbeddingAdapter implements EmbeddingPort {
  readonly model: string;
  readonly dimensions = 1536;
  embedCalls = 0;

  constructor(model = 'fake-embedding-test') {
    this.model = model;
  }

  async embed(text: string): Promise<EmbedResult> {
    this.embedCalls += 1;
    const vector = new Array<number>(this.dimensions).fill(0);
    const tokens = text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 1);

    for (const token of tokens) {
      const hash = createHash('sha256').update(token).digest();
      for (let i = 0; i < 16; i += 1) {
        const index = hash[i]! % this.dimensions;
        const sign = hash[i]! % 2 === 0 ? 1 : -1;
        vector[index]! += sign * ((hash[(i + 8) % 32]! + 1) / 256);
      }
    }

    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
    return {
      vector: vector.map((v) => v / norm),
      model: this.model,
      dimensions: this.dimensions,
    };
  }
}
