import { ConfigService } from '@nestjs/config';
import { GeminiEmbeddingAdapter } from './gemini-embedding.adapter';

function config(values: Record<string, string>): ConfigService {
  return {
    get(key: string, defaultValue?: string) {
      return values[key] ?? defaultValue;
    },
  } as ConfigService;
}

describe('GeminiEmbeddingAdapter', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('requests a 1536-d document embedding with the retrieval prefix', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        embedding: { values: new Array<number>(1536).fill(0.1) },
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const adapter = new GeminiEmbeddingAdapter(
      config({ GEMINI_API_KEY: 'gem-key' }),
    );
    const result = await adapter.embed('Apache Kafka docs', 'document');

    expect(result.model).toBe('gemini-embedding-2');
    expect(result.dimensions).toBe(1536);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent',
    );
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(
      'gem-key',
    );
    expect(JSON.parse(init.body as string)).toEqual({
      content: {
        parts: [{ text: 'title: none | text: Apache Kafka docs' }],
      },
      output_dimensionality: 1536,
    });
  });

  it('prefixes questions for asymmetric retrieval', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        embedding: { values: new Array<number>(1536).fill(0.1) },
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const adapter = new GeminiEmbeddingAdapter(
      config({
        GEMINI_API_KEY: 'gem-key',
        GEMINI_EMBEDDING_MODEL: 'models/gemini-embedding-2',
      }),
    );
    await adapter.embed('What did I read about queues?', 'query');

    const body = JSON.parse(
      (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string,
    ) as { content: { parts: Array<{ text: string }> } };
    expect(body.content.parts[0]?.text).toBe(
      'task: question answering | query: What did I read about queues?',
    );
  });

  it('rejects a vector that is not 1536 dimensions', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: { values: [0.1, 0.2] } }),
    }) as unknown as typeof fetch;

    const adapter = new GeminiEmbeddingAdapter(
      config({ GEMINI_API_KEY: 'gem-key' }),
    );
    await expect(adapter.embed('Kafka')).rejects.toThrow(/1536/);
  });
});
