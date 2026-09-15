import type {
  GenerateInput,
  GenerateResult,
  LLMPort,
} from 'src/domain/ports/llm-port';

/**
 * Fake LLM for unit/e2e tests.
 */
export class FakeLlmAdapter implements LLMPort {
  generateCalls = 0;
  failNext = false;
  lastInput: GenerateInput | null = null;

  async generate(input: GenerateInput): Promise<GenerateResult> {
    this.generateCalls += 1;
    this.lastInput = input;
    if (this.failNext) {
      this.failNext = false;
      throw new Error('Fake LLM unavailable');
    }
    return {
      text: 'Based on your sources [1], you read related material.',
    };
  }
}
