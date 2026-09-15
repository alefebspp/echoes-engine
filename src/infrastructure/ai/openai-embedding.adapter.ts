import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  EmbedResult,
  EmbeddingPort,
} from 'src/domain/ports/embedding-port';

@Injectable()
export class OpenAiEmbeddingAdapter implements EmbeddingPort {
  readonly model: string;
  private readonly timeoutMs: number;
  private readonly dimensions: number;

  constructor(private readonly configService: ConfigService) {
    this.model =
      this.configService.get<string>('OPENAI_EMBEDDING_MODEL') ??
      'text-embedding-3-small';
    this.timeoutMs = parseInt(
      this.configService.get<string>('OPENAI_EMBEDDING_TIMEOUT_MS', '10000'),
      10,
    );
    this.dimensions = 1536;
  }

  async embed(text: string): Promise<EmbedResult> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY') ?? '';
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: text,
          dimensions: this.dimensions,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `OpenAI embeddings failed (${response.status}): ${body.slice(0, 200)}`,
        );
      }

      const payload = (await response.json()) as {
        data?: Array<{ embedding?: number[] }>;
      };
      const vector = payload.data?.[0]?.embedding;
      if (!vector || vector.length === 0) {
        throw new Error('OpenAI embedding response contained no vector');
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
