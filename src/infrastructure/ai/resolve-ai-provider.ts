export type AiProviderName = 'gemini' | 'openai' | 'fake';

export type AiProviderEnv = {
  AI_PROVIDER?: string;
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
};

/**
 * Explicit `AI_PROVIDER` wins. Otherwise an OpenAI key keeps the previous
 * default, then a Gemini key, then the in-process fake adapters.
 */
export function resolveAiProvider(env: AiProviderEnv): AiProviderName {
  const explicit = (env.AI_PROVIDER ?? '').trim().toLowerCase();
  if (explicit.length > 0) {
    if (explicit === 'gemini' || explicit === 'openai' || explicit === 'fake') {
      return explicit;
    }
    throw new Error(
      `Unknown AI_PROVIDER "${explicit}". Use gemini, openai, or fake.`,
    );
  }

  if ((env.OPENAI_API_KEY ?? '').trim().length > 0) {
    return 'openai';
  }
  if ((env.GEMINI_API_KEY ?? '').trim().length > 0) {
    return 'gemini';
  }
  return 'fake';
}
