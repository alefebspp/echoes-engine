import { ConfigService } from '@nestjs/config';
import { GeminiLlmAdapter } from './gemini-llm.adapter';

function config(values: Record<string, string>): ConfigService {
  return {
    get(key: string, defaultValue?: string) {
      return values[key] ?? defaultValue;
    },
  } as ConfigService;
}

describe('GeminiLlmAdapter', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('calls the OpenAI-compatible chat endpoint with low reasoning effort', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'You read Kafka [1].' } }],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const adapter = new GeminiLlmAdapter(config({ GEMINI_API_KEY: 'gem-key' }));
    const result = await adapter.generate({
      systemPrompt: 'Use only the sources.',
      userPrompt: 'What did I read?',
      maxTokens: 500,
    });

    expect(result.text).toBe('You read Kafka [1].');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer gem-key',
    );
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: 'gemini-3.8-flash',
      max_tokens: 500,
      reasoning_effort: 'low',
    });
  });

  it('reads text when content is a list of parts', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          { message: { content: [{ text: 'From ' }, { text: '[1].' }] } },
        ],
      }),
    }) as unknown as typeof fetch;

    const adapter = new GeminiLlmAdapter(config({ GEMINI_API_KEY: 'gem-key' }));
    await expect(
      adapter.generate({ systemPrompt: 's', userPrompt: 'u' }),
    ).resolves.toEqual({ text: 'From [1].' });
  });
});
