import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AskQuestionUseCase } from 'src/application/ai/ask-question-use-case';
import type { AskQuestionLogger } from 'src/application/ai/ask-question-use-case';
import { FindSimilarEventsUseCase } from 'src/application/ai/find-similar-events-use-case';
import type { FindSimilarEventsLogger } from 'src/application/ai/find-similar-events-use-case';
import { GenerateEmbeddingUseCase } from 'src/application/ai/generate-embedding-use-case';
import type { GenerateEmbeddingLogger } from 'src/application/ai/generate-embedding-use-case';
import { AppLogger } from 'src/common/logging/app-logger.service';
import type { EventRepository } from 'src/domain/event/event-repository';
import type { EmbeddingPort } from 'src/domain/ports/embedding-port';
import type { EventEmbeddingStore } from 'src/domain/ports/event-embedding-store';
import type { LLMPort } from 'src/domain/ports/llm-port';
import { GeminiEmbeddingAdapter } from 'src/infrastructure/ai/gemini-embedding.adapter';
import { GeminiLlmAdapter } from 'src/infrastructure/ai/gemini-llm.adapter';
import { OpenAiEmbeddingAdapter } from 'src/infrastructure/ai/openai-embedding.adapter';
import { OpenAiLlmAdapter } from 'src/infrastructure/ai/openai-llm.adapter';
import { FakeEmbeddingAdapter } from 'src/infrastructure/ai/fake-embedding.adapter';
import { FakeLlmAdapter } from 'src/infrastructure/ai/fake-llm.adapter';
import { resolveAiProvider } from 'src/infrastructure/ai/resolve-ai-provider';
import {
  EMBEDDING_PORT,
  EVENT_EMBEDDING_STORE,
  EVENT_REPOSITORY,
  LLM_PORT,
} from 'src/infrastructure/nest/injection-tokens';
import { TypeOrmEventEmbeddingStore } from 'src/infrastructure/typeorm/event-embedding-store';
import { EventModule } from 'src/presentation/event/event.module';
import { AiController } from './ai.controller';
import { SimilarEventsController } from './similar-events.controller';

@Module({
  imports: [ConfigModule, EventModule],
  controllers: [AiController, SimilarEventsController],
  providers: [
    OpenAiEmbeddingAdapter,
    OpenAiLlmAdapter,
    GeminiEmbeddingAdapter,
    GeminiLlmAdapter,
    TypeOrmEventEmbeddingStore,
    {
      provide: EMBEDDING_PORT,
      useFactory: (
        configService: ConfigService,
        openAi: OpenAiEmbeddingAdapter,
        gemini: GeminiEmbeddingAdapter,
      ): EmbeddingPort => {
        const provider = resolveAiProvider({
          AI_PROVIDER: configService.get<string>('AI_PROVIDER'),
          GEMINI_API_KEY: configService.get<string>('GEMINI_API_KEY'),
          OPENAI_API_KEY: configService.get<string>('OPENAI_API_KEY'),
        });
        if (provider === 'gemini') {
          return gemini;
        }
        if (provider === 'openai') {
          return openAi;
        }
        return new FakeEmbeddingAdapter(
          configService.get<string>('OPENAI_EMBEDDING_MODEL') ??
            'fake-embedding-test',
        );
      },
      inject: [ConfigService, OpenAiEmbeddingAdapter, GeminiEmbeddingAdapter],
    },
    {
      provide: LLM_PORT,
      useFactory: (
        configService: ConfigService,
        openAi: OpenAiLlmAdapter,
        gemini: GeminiLlmAdapter,
      ): LLMPort => {
        const provider = resolveAiProvider({
          AI_PROVIDER: configService.get<string>('AI_PROVIDER'),
          GEMINI_API_KEY: configService.get<string>('GEMINI_API_KEY'),
          OPENAI_API_KEY: configService.get<string>('OPENAI_API_KEY'),
        });
        if (provider === 'gemini') {
          return gemini;
        }
        if (provider === 'openai') {
          return openAi;
        }
        return new FakeLlmAdapter();
      },
      inject: [ConfigService, OpenAiLlmAdapter, GeminiLlmAdapter],
    },
    {
      provide: EVENT_EMBEDDING_STORE,
      useExisting: TypeOrmEventEmbeddingStore,
    },
    {
      provide: GenerateEmbeddingUseCase,
      useFactory: (
        eventRepository: EventRepository,
        embeddingPort: EmbeddingPort,
        eventEmbeddingStore: EventEmbeddingStore,
        logger: AppLogger,
      ) => {
        logger.setContext(GenerateEmbeddingUseCase.name);
        return new GenerateEmbeddingUseCase(
          eventRepository,
          embeddingPort,
          eventEmbeddingStore,
          logger as GenerateEmbeddingLogger,
        );
      },
      inject: [
        EVENT_REPOSITORY,
        EMBEDDING_PORT,
        EVENT_EMBEDDING_STORE,
        AppLogger,
      ],
    },
    {
      provide: FindSimilarEventsUseCase,
      useFactory: (
        eventRepository: EventRepository,
        eventEmbeddingStore: EventEmbeddingStore,
        logger: AppLogger,
      ) => {
        logger.setContext(FindSimilarEventsUseCase.name);
        return new FindSimilarEventsUseCase(
          eventRepository,
          eventEmbeddingStore,
          logger as FindSimilarEventsLogger,
        );
      },
      inject: [EVENT_REPOSITORY, EVENT_EMBEDDING_STORE, AppLogger],
    },
    {
      provide: AskQuestionUseCase,
      useFactory: (
        embeddingPort: EmbeddingPort,
        llmPort: LLMPort,
        eventEmbeddingStore: EventEmbeddingStore,
        logger: AppLogger,
        configService: ConfigService,
      ) => {
        logger.setContext(AskQuestionUseCase.name);
        return new AskQuestionUseCase(
          embeddingPort,
          llmPort,
          eventEmbeddingStore,
          logger as AskQuestionLogger,
          {
            limit: parseInt(
              configService.get<string>('RAG_DEFAULT_LIMIT', '8'),
              10,
            ),
            minSimilarity: parseFloat(
              configService.get<string>('RAG_SIMILARITY_THRESHOLD', '0.25'),
            ),
          },
        );
      },
      inject: [
        EMBEDDING_PORT,
        LLM_PORT,
        EVENT_EMBEDDING_STORE,
        AppLogger,
        ConfigService,
      ],
    },
  ],
  exports: [
    EMBEDDING_PORT,
    LLM_PORT,
    EVENT_EMBEDDING_STORE,
    GenerateEmbeddingUseCase,
    FindSimilarEventsUseCase,
    AskQuestionUseCase,
  ],
})
export class AiModule {}
