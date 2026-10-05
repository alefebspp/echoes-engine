import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { GenerateEmbeddingUseCase } from '../src/application/ai/generate-embedding-use-case';
import { EventOrmEntity } from '../src/infrastructure/typeorm/entities/event.entity';
import { OutboxMessageOrmEntity } from '../src/infrastructure/typeorm/entities/outbox-message.entity';
import { UserOrmEntity } from '../src/infrastructure/typeorm/entities/user.entity';
import { OutboxPublisher } from '../src/infrastructure/queue/outbox-publisher.service';
import { createTestApp } from './create-test-app';
import { waitFor } from './wait-for';

describe('AI endpoints (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;
  let userId: string;

  const validUser = {
    name: 'Ai',
    surname: 'User',
    email: 'ai@echoes.local',
    password: 'demo1234',
  };

  beforeEach(async () => {
    process.env.OPENAI_API_KEY = '';
    app = await createTestApp();
    const createUser = await request(app.getHttpServer())
      .post('/api/v1/users')
      .send(validUser)
      .expect(201);
    userId = createUser.body.id as string;
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: validUser.password });
    token = loginResponse.body.token;
  });

  afterEach(async () => {
    const dataSource = app.get(DataSource);
    await dataSource.query('DELETE FROM event_embeddings');
    const eventsRepository = app.get<Repository<EventOrmEntity>>(
      getRepositoryToken(EventOrmEntity),
    );
    await eventsRepository
      .createQueryBuilder()
      .delete()
      .from(EventOrmEntity)
      .execute();
    const outboxRepository = app.get<Repository<OutboxMessageOrmEntity>>(
      getRepositoryToken(OutboxMessageOrmEntity),
    );
    await outboxRepository
      .createQueryBuilder()
      .delete()
      .from(OutboxMessageOrmEntity)
      .execute();
    const usersRepository = app.get<Repository<UserOrmEntity>>(
      getRepositoryToken(UserOrmEntity),
    );
    await usersRepository
      .createQueryBuilder()
      .delete()
      .from(UserOrmEntity)
      .execute();
    await app.close();
  });

  async function submitEvent(payload: Record<string, unknown>) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);
    return response.body.id as string;
  }

  async function waitForEmbedding(eventId: string) {
    const publisher = app.get(OutboxPublisher);
    await publisher.publishPending();
    const dataSource = app.get(DataSource);
    await waitFor(async () => {
      const rows = await dataSource.query(
        `SELECT event_id FROM event_embeddings WHERE event_id = $1 AND user_id = $2`,
        [eventId, userId],
      );
      expect(rows).toHaveLength(1);
    });
  }

  it('embeds async then returns vector similar events', async () => {
    const kafkaId = await submitEvent({
      type: 'WEB_VISIT',
      timestamp: '2026-06-12T15:30:00.000Z',
      source: 'browser_extension',
      metadata: {
        url: 'https://kafka.apache.org',
        title: 'Apache Kafka',
        browser: 'chrome',
      },
    });
    const rabbitId = await submitEvent({
      type: 'WEB_VISIT',
      timestamp: '2026-06-13T15:30:00.000Z',
      source: 'browser_extension',
      metadata: {
        url: 'https://www.rabbitmq.com/tutorials',
        title: 'RabbitMQ Tutorial',
        browser: 'chrome',
      },
    });

    await waitForEmbedding(kafkaId);
    await waitForEmbedding(rabbitId);

    const similar = await request(app.getHttpServer())
      .get(`/api/v1/events/${kafkaId}/similar`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(similar.body.mode).toBe('vector');
    expect(similar.body.items.map((item: { eventId: string }) => item.eventId)).toContain(
      rabbitId,
    );
  });

  it('answers RAG ask with citations and refuses when empty', async () => {
    const eventId = await submitEvent({
      type: 'WEB_VISIT',
      timestamp: '2026-06-12T15:30:00.000Z',
      source: 'browser_extension',
      metadata: {
        url: 'https://kafka.apache.org',
        title: 'Apache Kafka documentation',
        browser: 'chrome',
      },
    });
    await waitForEmbedding(eventId);

    const answered = await request(app.getHttpServer())
      .post('/api/v1/ai/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'What did I read about Apache Kafka documentation?' })
      .expect(200);

    expect(answered.body.refused).toBe(false);
    expect(answered.body.mode).toBe('answer');
    expect(answered.body.retrievedCount).toBeGreaterThan(0);
    expect(answered.body.citations[0].eventId).toBe(eventId);

    const refused = await request(app.getHttpServer())
      .post('/api/v1/ai/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({
        question: 'What did I read about underwater basket weaving?',
        from: '2099-01-01T00:00:00.000Z',
        to: '2099-01-02T00:00:00.000Z',
      })
      .expect(200);

    expect(refused.body.refused).toBe(true);
    expect(refused.body.mode).toBe('refused');
    expect(refused.body.retrievedCount).toBe(0);
  });

  it('keeps generate embedding idempotent when invoked twice', async () => {
    const eventId = await submitEvent({
      type: 'WEB_VISIT',
      timestamp: '2026-06-12T15:30:00.000Z',
      source: 'browser_extension',
      metadata: {
        url: 'https://kafka.apache.org',
        title: 'Apache Kafka',
      },
    });

    const useCase = app.get(GenerateEmbeddingUseCase);
    const first = await useCase.execute(eventId);
    const second = await useCase.execute(eventId);

    expect(first.status).toBe('embedded');
    expect(second.status).toBe('skipped');
  });
});
