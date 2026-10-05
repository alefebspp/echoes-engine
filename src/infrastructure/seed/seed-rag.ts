/**
 * Idempotent local seed for RAG / similar-events.
 * Usage: `npm run seed:rag` (Postgres must be up; run `npm run migration:run` first).
 */
import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import {
  buildEventEmbeddingText,
  hashEmbeddingContent,
} from 'src/application/ai/embedding-text';
import { categorizeAppName } from 'src/domain/event-tag/app-name-tag-categorizer';
import { categorizeUrl } from 'src/domain/event-tag/url-tag-categorizer';
import type { EmbeddingPort } from 'src/domain/ports/embedding-port';
import { FakeEmbeddingAdapter } from 'src/infrastructure/ai/fake-embedding.adapter';
import { GeminiEmbeddingAdapter } from 'src/infrastructure/ai/gemini-embedding.adapter';
import { OpenAiEmbeddingAdapter } from 'src/infrastructure/ai/openai-embedding.adapter';
import { resolveAiProvider } from 'src/infrastructure/ai/resolve-ai-provider';
import { DEFAULT_EVENT_SOURCES } from 'src/infrastructure/event-sources/event-source-seeder';
import { TypeOrmEventEmbeddingStore } from 'src/infrastructure/typeorm/event-embedding-store';
import { EventOrmEntity } from 'src/infrastructure/typeorm/entities/event.entity';
import { EventSourceOrmEntity } from 'src/infrastructure/typeorm/entities/event-source.entity';
import { EventTagOrmEntity } from 'src/infrastructure/typeorm/entities/event-tag.entity';
import { UserOrmEntity } from 'src/infrastructure/typeorm/entities/user.entity';
import { UserSettingsOrmEntity } from 'src/infrastructure/typeorm/entities/user-settings.entity';
import dataSource from 'src/data-source';
import {
  RAG_SEED_EVENTS,
  RAG_SEED_EXTERNAL_ID_PREFIX,
  RAG_SEED_USER,
  type RagSeedEvent,
} from './rag-seed-data';

function createEmbeddingPort(): EmbeddingPort {
  const config = {
    get(key: string, defaultValue?: string) {
      const value = process.env[key];
      return value === undefined || value.length === 0 ? defaultValue : value;
    },
  } as ConfigService;

  const provider = resolveAiProvider(process.env);
  if (provider === 'gemini') {
    return new GeminiEmbeddingAdapter(config);
  }
  if (provider === 'openai') {
    return new OpenAiEmbeddingAdapter(config);
  }

  return new FakeEmbeddingAdapter(
    process.env.OPENAI_EMBEDDING_MODEL ?? 'fake-embedding-test',
  );
}

function tagsFor(
  event: RagSeedEvent,
): Array<{ tag: string; confidence: number }> {
  if (event.type === 'WEB_VISIT') {
    const url =
      typeof event.metadata.url === 'string' ? event.metadata.url : '';
    return categorizeUrl(url);
  }

  const appName =
    typeof event.metadata.appName === 'string' ? event.metadata.appName : '';
  return categorizeAppName(appName);
}

async function ensureEventSources(): Promise<Map<string, string>> {
  const sources = dataSource.getRepository(EventSourceOrmEntity);
  const idsByCode = new Map<string, string>();

  for (const source of DEFAULT_EVENT_SOURCES) {
    let existing = await sources.findOneBy({ code: source.code });
    if (!existing) {
      existing = await sources.save(sources.create(source));
    }
    idsByCode.set(source.code, existing.id);
  }

  return idsByCode;
}

async function upsertDemoUser(): Promise<string> {
  const users = dataSource.getRepository(UserOrmEntity);
  const settings = dataSource.getRepository(UserSettingsOrmEntity);
  const passwordHash = await bcrypt.hash(RAG_SEED_USER.password, 12);
  const email = RAG_SEED_USER.email.toLowerCase();

  let user = await users.findOneBy({ email });
  if (!user) {
    user = await users.save(
      users.create({
        id: RAG_SEED_USER.id,
        name: RAG_SEED_USER.name,
        surname: RAG_SEED_USER.surname,
        email,
        password: passwordHash,
      }),
    );
  } else {
    user.password = passwordHash;
    user.name = RAG_SEED_USER.name;
    user.surname = RAG_SEED_USER.surname;
    user = await users.save(user);
  }

  const existingSettings = await settings.findOneBy({ userId: user.id });
  if (!existingSettings) {
    await settings.save(
      settings.create({
        userId: user.id,
        timezone: 'UTC',
        trackingEnabled: true,
      }),
    );
  }

  return user.id;
}

async function replaceSeedEvents(
  userId: string,
  sourceIdsByCode: Map<string, string>,
): Promise<void> {
  const events = dataSource.getRepository(EventOrmEntity);
  const tags = dataSource.getRepository(EventTagOrmEntity);

  await events
    .createQueryBuilder()
    .delete()
    .where('user_id = :userId', { userId })
    .andWhere('external_event_id LIKE :prefix', {
      prefix: `${RAG_SEED_EXTERNAL_ID_PREFIX}%`,
    })
    .execute();

  for (const seed of RAG_SEED_EVENTS) {
    const sourceId = sourceIdsByCode.get(seed.source);
    if (!sourceId) {
      throw new Error(
        `Missing event source "${seed.source}". Run migrations first.`,
      );
    }

    const saved = await events.save(
      events.create({
        id: seed.id,
        userId,
        sourceId,
        eventType: seed.type,
        occurredAt: new Date(seed.occurredAt),
        metadata: seed.metadata,
        externalEventId: seed.externalEventId,
        tagsAssigned: true,
      }),
    );

    const assigned = tagsFor(seed);
    if (assigned.length === 0) {
      continue;
    }

    await tags.save(
      assigned.map((match) =>
        tags.create({
          eventId: saved.id,
          tag: match.tag,
          confidence: match.confidence.toFixed(4),
        }),
      ),
    );
  }
}

async function embedSeedEvents(
  userId: string,
  embeddingPort: EmbeddingPort,
): Promise<void> {
  const store = new TypeOrmEventEmbeddingStore(dataSource);

  for (const seed of RAG_SEED_EVENTS) {
    const text = buildEventEmbeddingText(seed.type, seed.metadata);
    if (!text) {
      throw new Error(
        `Seed event ${seed.externalEventId} has no embeddable text.`,
      );
    }

    const embedded = await embeddingPort.embed(text, 'document');
    await store.upsert({
      eventId: seed.id,
      userId,
      vector: embedded.vector,
      model: embedded.model,
      dimensions: embedded.dimensions,
      contentHash: hashEmbeddingContent(text),
    });
  }
}

function printSummary(userId: string, embeddingPort: EmbeddingPort): void {
  const kafkaId = RAG_SEED_EVENTS[0]?.id;
  const provider = resolveAiProvider(process.env);

  console.log('');
  console.log('RAG seed imported.');
  console.log(`  user id:  ${userId}`);
  console.log(`  email:    ${RAG_SEED_USER.email}`);
  console.log(`  password: ${RAG_SEED_USER.password}`);
  console.log(`  events:   ${RAG_SEED_EVENTS.length}`);
  console.log(`  model:    ${embeddingPort.model} (${provider})`);
  console.log('');
  console.log('Login:');
  console.log(
    `  curl -s http://localhost:3000/api/v1/auth/login \\
    -H 'Content-Type: application/json' \\
    -d '{"email":"${RAG_SEED_USER.email}","password":"${RAG_SEED_USER.password}"}'`,
  );
  console.log('');
  console.log('Ask (replace TOKEN):');
  console.log(
    `  curl -s http://localhost:3000/api/v1/ai/ask \\
    -H 'Authorization: Bearer TOKEN' \\
    -H 'Content-Type: application/json' \\
    -d '{"question":"What did I read about message queues?"}'`,
  );
  if (kafkaId) {
    console.log('');
    console.log('Similar events (Kafka):');
    console.log(
      `  curl -s http://localhost:3000/api/v1/events/${kafkaId}/similar \\
    -H 'Authorization: Bearer TOKEN'`,
    );
  }
}

async function main(): Promise<void> {
  try {
    await dataSource.initialize();
  } catch (error) {
    console.error(
      'Could not connect to Postgres. Start it with `docker compose up -d db`, then run `npm run migration:run`.',
    );
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exitCode = 1;
    return;
  }

  try {
    const embeddingPort = createEmbeddingPort();
    const sourceIdsByCode = await ensureEventSources();
    const userId = await upsertDemoUser();
    await replaceSeedEvents(userId, sourceIdsByCode);
    await embedSeedEvents(userId, embeddingPort);
    printSummary(userId, embeddingPort);
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
