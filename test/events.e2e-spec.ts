import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { EventOrmEntity } from '../src/infrastructure/typeorm/entities/event.entity';
import { EventTagOrmEntity } from '../src/infrastructure/typeorm/entities/event-tag.entity';
import { OutboxMessageOrmEntity } from '../src/infrastructure/typeorm/entities/outbox-message.entity';
import { UserOrmEntity } from '../src/infrastructure/typeorm/entities/user.entity';
import { OutboxPublisher } from '../src/infrastructure/queue/outbox-publisher.service';
import { EnrichEventTagsUseCase } from '../src/application/event/enrich-event-tags-use-case';
import { createTestApp } from './create-test-app';

async function waitFor(
  assertion: () => Promise<void>,
  timeoutMs = 10_000,
  intervalMs = 200,
): Promise<void> {
  const started = Date.now();
  let lastError: unknown;

  while (Date.now() - started < timeoutMs) {
    try {
      await assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('waitFor timed out');
}

describe('EventsController (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;

  const validUser = {
    name: 'Demo',
    surname: 'User',
    email: 'demo@echoes.local',
    password: 'demo1234',
  };

  const loginCredentials = {
    email: validUser.email,
    password: validUser.password,
  };

  const webVisitEvent = {
    type: 'WEB_VISIT',
    timestamp: '2026-06-12T15:30:00.000Z',
    source: 'browser_extension',
    metadata: {
      url: 'https://kafka.apache.org',
      title: 'Apache Kafka',
      browser: 'chrome',
    },
  };

  beforeEach(async () => {
    app = await createTestApp();
    await request(app.getHttpServer()).post('/api/v1/users').send(validUser);
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(loginCredentials);
    token = loginResponse.body.token;
  });

  afterEach(async () => {
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

  describe('POST /api/v1/events', () => {
    it('accepts a web visit event with a bearer token', () => {
      return request(app.getHttpServer())
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${token}`)
        .send(webVisitEvent)
        .expect(201)
        .expect((res) => {
          expect(res.body).toMatchObject({
            id: expect.any(String),
            status: 'accepted',
          });
        });
    });

    it('accepts queue fields and treats id as idempotency key', async () => {
      const queuedEvent = {
        ...webVisitEvent,
        id: '550e8400-e29b-41d4-a716-446655440000',
        attempts: 0,
        createdAt: '2026-06-12T15:30:01.123Z',
      };

      const first = await request(app.getHttpServer())
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${token}`)
        .send(queuedEvent)
        .expect(201);

      const second = await request(app.getHttpServer())
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${token}`)
        .send(queuedEvent)
        .expect(201);

      expect(second.body.id).toBe(first.body.id);

      const eventsRepository = app.get<Repository<EventOrmEntity>>(
        getRepositoryToken(EventOrmEntity),
      );
      const storedEvents = await eventsRepository.findBy({
        userId: (
          await eventsRepository.findOneByOrFail({ id: first.body.id })
        ).userId,
        externalEventId: queuedEvent.id,
      });
      expect(storedEvents).toHaveLength(1);
    });

    it('writes an outbox row and enriches tags asynchronously', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${token}`)
        .set('x-correlation-id', 'e2e-corr-1')
        .send(webVisitEvent)
        .expect(201);

      const eventId = response.body.id as string;
      const eventsRepository = app.get<Repository<EventOrmEntity>>(
        getRepositoryToken(EventOrmEntity),
      );
      const outboxRepository = app.get<Repository<OutboxMessageOrmEntity>>(
        getRepositoryToken(OutboxMessageOrmEntity),
      );
      const eventTagsRepository = app.get<Repository<EventTagOrmEntity>>(
        getRepositoryToken(EventTagOrmEntity),
      );

      const storedEvent = await eventsRepository.findOneByOrFail({
        id: eventId,
      });
      expect(storedEvent.tagsAssigned).toBe(false);

      const outboxRows = await outboxRepository.find();
      expect(outboxRows).toEqual([
        expect.objectContaining({
          type: 'EventIngested',
          publishedAt: null,
          payload: expect.objectContaining({
            eventId,
            eventType: 'WEB_VISIT',
            correlationId: 'e2e-corr-1',
          }),
        }),
      ]);

      expect(
        await eventTagsRepository.findBy({ eventId }),
      ).toHaveLength(0);

      const publisher = app.get(OutboxPublisher);
      await publisher.publishPending();

      await waitFor(async () => {
        const tags = await eventTagsRepository.findBy({ eventId });
        expect(tags).toEqual([
          expect.objectContaining({
            eventId,
            tag: 'developer tools',
            confidence: '0.9500',
          }),
        ]);
      });

      const enrichedEvent = await eventsRepository.findOneByOrFail({
        id: eventId,
      });
      expect(enrichedEvent.tagsAssigned).toBe(true);

      const publishedOutbox = await outboxRepository.find();
      expect(publishedOutbox[0].publishedAt).not.toBeNull();
    });

    it('does not duplicate tags when enrichment runs twice', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${token}`)
        .send(webVisitEvent)
        .expect(201);

      const eventId = response.body.id as string;
      const enrichUseCase = app.get(EnrichEventTagsUseCase);
      const eventTagsRepository = app.get<Repository<EventTagOrmEntity>>(
        getRepositoryToken(EventTagOrmEntity),
      );

      await enrichUseCase.execute(eventId);
      await enrichUseCase.execute(eventId);

      const tags = await eventTagsRepository.findBy({ eventId });
      expect(tags).toHaveLength(1);
      expect(tags[0].tag).toBe('developer tools');
    });

    it('accepts an app visit event and tags by app name asynchronously', async () => {
      const appVisitEvent = {
        type: 'APP_VISIT',
        timestamp: '2026-06-12T15:30:00.000Z',
        source: 'mobile_sdk',
        metadata: {
          appName: 'Instagram',
          packageName: 'com.instagram.android',
        },
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${token}`)
        .send(appVisitEvent)
        .expect(201);

      const eventId = response.body.id as string;
      const publisher = app.get(OutboxPublisher);
      await publisher.publishPending();

      const eventTagsRepository = app.get<Repository<EventTagOrmEntity>>(
        getRepositoryToken(EventTagOrmEntity),
      );

      await waitFor(async () => {
        const tags = await eventTagsRepository.findBy({ eventId });
        expect(tags).toEqual([
          expect.objectContaining({
            eventId,
            tag: 'social media',
            confidence: '0.9500',
          }),
        ]);
      });
    });

    it('returns 401 without a bearer token', () => {
      return request(app.getHttpServer())
        .post('/api/v1/events')
        .send(webVisitEvent)
        .expect(401);
    });

    it('returns 400 for invalid payload', () => {
      return request(app.getHttpServer())
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'WEB_VISIT' })
        .expect(400);
    });
  });
});
