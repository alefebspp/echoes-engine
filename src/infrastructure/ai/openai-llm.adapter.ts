import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  GenerateInput,
  GenerateResult,
  LLMPort,
} from 'src/domain/ports/llm-port';

@Injectable()
export class OpenAiLlmAdapter implements LLMPort {
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.model =
      this.configService.get<string>('OPENAI_LLM_MODEL') ?? 'gpt-4o-mini';
    this.timeoutMs = parseInt(
      this.configService.get<string>('OPENAI_LLM_TIMEOUT_MS', '30000'),
      10,
    );
  }

  async generate(input: GenerateInput): Promise<GenerateResult> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY') ?? '';
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.model,
            max_tokens: input.maxTokens ?? 500,
            messages: [
              { role: 'system', content: input.systemPrompt },
              { role: 'user', content: input.userPrompt },
            ],
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `OpenAI chat failed (${response.status}): ${body.slice(0, 200)}`,
        );
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
      };
      const text = payload.choices?.[0]?.message?.content?.trim();
      if (!text) {
        throw new Error('OpenAI LLM response contained no text');
      }

      return { text };
    } finally {
      clearTimeout(timer);
    }
  }
}
