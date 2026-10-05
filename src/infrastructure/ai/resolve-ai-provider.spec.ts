import { resolveAiProvider } from './resolve-ai-provider';

describe('resolveAiProvider', () => {
  it('uses an explicit provider', () => {
    expect(
      resolveAiProvider({
        AI_PROVIDER: 'gemini',
        OPENAI_API_KEY: 'sk-openai',
      }),
    ).toBe('gemini');
    expect(resolveAiProvider({ AI_PROVIDER: 'fake' })).toBe('fake');
  });

  it('keeps OpenAI when only that key is set', () => {
    expect(resolveAiProvider({ OPENAI_API_KEY: 'sk-openai' })).toBe('openai');
  });

  it('selects Gemini when that key is set and OpenAI is not', () => {
    expect(resolveAiProvider({ GEMINI_API_KEY: 'gem-key' })).toBe('gemini');
  });

  it('stays on the fake adapters when no key is set', () => {
    expect(resolveAiProvider({})).toBe('fake');
  });

  it('rejects an unknown provider name', () => {
    expect(() => resolveAiProvider({ AI_PROVIDER: 'groq' })).toThrow(
      /Unknown AI_PROVIDER/,
    );
  });
});
