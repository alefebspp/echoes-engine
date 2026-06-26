import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { EventTag } from '../src/event-tags/event-tag.entity';
import { EventTagsService } from '../src/event-tags/event-tags.service';
import { Event } from '../src/events/event.entity';
import { User } from '../src/users/user.entity';
import { createTestApp } from './create-test-app';

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
    const eventsRepository = app.get<Repository<Event>>(getRepositoryToken(Event));
    await eventsRepository.createQueryBuilder().delete().from(Event).execute();
    const usersRepository = app.get<Repository<User>>(getRepositoryToken(User));
    await usersRepository.createQueryBuilder().delete().from(User).execute();
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

      const eventsRepository = app.get<Repository<Event>>(
        getRepositoryToken(Event),
      );
      const storedEvents = await eventsRepository.findBy({
        userId: (
          await eventsRepository.findOneByOrFail({ id: first.body.id })
        ).userId,
        externalEventId: queuedEvent.id,
      });
      expect(storedEvents).toHaveLength(1);
    });

    it('persists event tags atomically with the event', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${token}`)
        .send(webVisitEvent)
        .expect(201);

      const eventTagsRepository = app.get<Repository<EventTag>>(
        getRepositoryToken(EventTag),
      );
      const tags = await eventTagsRepository.findBy({
        eventId: response.body.id,
      });

      expect(tags).toEqual([
        expect.objectContaining({
          eventId: response.body.id,
          tag: 'developer tools',
          confidence: '0.9500',
        }),
      ]);
    });

    it('does not persist the event when tag creation fails', async () => {
      const eventTagsService = app.get(EventTagsService);
      const eventsRepository = app.get<Repository<Event>>(
        getRepositoryToken(Event),
      );
      const eventTagsRepository = app.get<Repository<EventTag>>(
        getRepositoryToken(EventTag),
      );

      jest
        .spyOn(eventTagsService, 'tagEventFromMetadata')
        .mockRejectedValueOnce(new Error('tag persistence failed'));

      await request(app.getHttpServer())
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${token}`)
        .send(webVisitEvent)
        .expect(400);

      const events = await eventsRepository.find();
      const tags = await eventTagsRepository.find();

      expect(events).toHaveLength(0);
      expect(tags).toHaveLength(0);
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
