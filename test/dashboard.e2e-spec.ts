import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { Event } from '../src/events/event.entity';
import { User } from '../src/users/user.entity';
import { createTestApp } from './create-test-app';

describe('DashboardController (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;

  const validUser = {
    name: 'Dashboard',
    surname: 'User',
    email: 'dashboard@echoes.local',
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

  describe('GET /api/v1/dashboard', () => {
    it('returns dashboard stats for the authenticated user', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${token}`)
        .send(webVisitEvent)
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        timezone: 'UTC',
        periodDays: 30,
        summary: {
          totalEvents: 1,
          eventsLast7Days: 1,
          eventsLast30Days: 1,
          activeDays: 1,
          untaggedEvents: 0,
        },
        categoryBreakdown: [
          expect.objectContaining({
            tag: 'developer tools',
            count: 1,
            percentage: 100,
          }),
        ],
        topDomains: [
          expect.objectContaining({
            domain: 'kafka.apache.org',
            count: 1,
          }),
        ],
        topBrowsers: [
          expect.objectContaining({
            browser: 'chrome',
            count: 1,
          }),
        ],
        eventsBySource: [
          expect.objectContaining({
            sourceCode: 'browser_extension',
            count: 1,
          }),
        ],
      });
      expect(response.body.summary.firstTrackedAt).toEqual(
        expect.any(String),
      );
      expect(response.body.summary.lastTrackedAt).toEqual(expect.any(String));
      expect(response.body.eventsByDay).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ count: 1 }),
        ]),
      );
    });

    it('accepts a custom period via query string', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/dashboard?days=14')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.periodDays).toBe(14);
    });

    it('returns 401 without a bearer token', () => {
      return request(app.getHttpServer()).get('/api/v1/dashboard').expect(401);
    });

    it('returns 400 for an invalid period', () => {
      return request(app.getHttpServer())
        .get('/api/v1/dashboard?days=3')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });
  });
});
