export type GenerateInput = {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
};

export type GenerateResult = {
  text: string;
};

/**
 * Port for LLM text generation. Infrastructure owns the provider SDK.
 */
export interface LLMPort {
  generate(input: GenerateInput): Promise<GenerateResult>;
}
