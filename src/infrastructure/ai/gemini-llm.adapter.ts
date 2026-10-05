import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  GenerateInput,
  GenerateResult,
  LLMPort,
} from 'src/domain/ports/llm-port';

/**
 * Gemini chat through the OpenAI-compatible endpoint.
 * Gemini 3 does not accept reasoning_effort=none. "low" keeps the answer
 * in message.content without spending the whole token budget on thoughts.
 */
@Injectable()
export class GeminiLlmAdapter implements LLMPort {
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly reasoningEffort: string;

  constructor(private readonly configService: ConfigService) {
    this.model =
      this.configService.get<string>('GEMINI_LLM_MODEL') ?? 'gemini-3.8-flash';
    this.timeoutMs = parseInt(
      this.configService.get<string>('GEMINI_LLM_TIMEOUT_MS', '30000'),
      10,
    );
    this.reasoningEffort =
      this.configService.get<string>('GEMINI_REASONING_EFFORT') ?? 'low';
  }

  async generate(input: GenerateInput): Promise<GenerateResult> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY') ?? '';
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const body: Record<string, unknown> = {
        model: this.model,
        max_tokens: input.maxTokens ?? 500,
        messages: [
          { role: 'system', content: input.systemPrompt },
          { role: 'user', content: input.userPrompt },
        ],
      };
      if (this.reasoningEffort.length > 0) {
        body.reasoning_effort = this.reasoningEffort;
      }

      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `Gemini chat failed (${response.status}): ${errorBody.slice(0, 200)}`,
        );
      }

      const payload = (await response.json()) as {
        choices?: Array<{
          message?: { content?: string | Array<{ text?: string }> | null };
        }>;
      };
      const text = readMessageContent(payload.choices?.[0]?.message?.content);
      if (!text) {
        throw new Error('Gemini LLM response contained no text');
      }

      return { text };
    } finally {
      clearTimeout(timer);
    }
  }
}

function readMessageContent(
  content: string | Array<{ text?: string }> | null | undefined,
): string {
  if (typeof content === 'string') {
    return content.trim();
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => part.text ?? '')
      .join('')
      .trim();
  }
  return '';
}
