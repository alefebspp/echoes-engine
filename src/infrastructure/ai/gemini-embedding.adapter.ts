import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  EmbedResult,
  EmbeddingPort,
  EmbeddingPurpose,
} from 'src/domain/ports/embedding-port';

const EMBEDDING_DIMENSIONS = 1536;

/**
 * Gemini Embedding 2 via the native embedContent API.
 * output_dimensionality is required: the default vector is 3072 and will not
 * fit event_embeddings.vector(1536). Truncated vectors are normalized by the
 * model. Document and query use the asymmetric prefixes Google recommends.
 */
@Injectable()
export class GeminiEmbeddingAdapter implements EmbeddingPort {
  readonly model: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    const configured =
      this.configService.get<string>('GEMINI_EMBEDDING_MODEL') ??
      'gemini-embedding-2';
    this.model = configured.replace(/^models\//, '');
    this.timeoutMs = parseInt(
      this.configService.get<string>('GEMINI_EMBEDDING_TIMEOUT_MS', '20000'),
      10,
    );
  }

  async embed(
    text: string,
    purpose: EmbeddingPurpose = 'document',
  ): Promise<EmbedResult> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY') ?? '';
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:embedContent`,
        {
          method: 'POST',
          headers: {
            'x-goog-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: {
              parts: [{ text: formatEmbeddingInput(text, purpose) }],
            },
            output_dimensionality: EMBEDDING_DIMENSIONS,
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `Gemini embeddings failed (${response.status}): ${body.slice(0, 200)}`,
        );
      }

      const payload = (await response.json()) as {
        embedding?: { values?: number[] };
      };
      const vector = payload.embedding?.values;
      if (!vector || vector.length === 0) {
        throw new Error('Gemini embedding response contained no vector');
      }
      if (vector.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Gemini embedding length ${vector.length} does not match required ${EMBEDDING_DIMENSIONS}`,
        );
      }

      return {
        vector,
        model: this.model,
        dimensions: vector.length,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

function formatEmbeddingInput(text: string, purpose: EmbeddingPurpose): string {
  if (purpose === 'query') {
    return `task: question answering | query: ${text}`;
  }
  return `title: none | text: ${text}`;
}
