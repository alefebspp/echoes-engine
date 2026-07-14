import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { UserOrmEntity } from '../src/infrastructure/typeorm/entities/user.entity';
import { createTestApp } from './create-test-app';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;

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

  beforeEach(async () => {
    app = await createTestApp();
    await request(app.getHttpServer()).post('/api/v1/users').send(validUser);
  });

  afterEach(async () => {
    const usersRepository = app.get<Repository<UserOrmEntity>>(getRepositoryToken(UserOrmEntity));
    await usersRepository.createQueryBuilder().delete().from(UserOrmEntity).execute();
    await app.close();
  });

  describe('POST /api/v1/auth/login', () => {
    it('returns a token and sets an httpOnly cookie for valid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(loginCredentials)
        .expect(201)
        .expect((res) => {
          expect(res.body.token).toEqual(expect.any(String));
          expect(res.body.token.length).toBeGreaterThan(0);

          const setCookie = res.headers['set-cookie'];
          expect(setCookie).toBeDefined();
          const cookieHeader = Array.isArray(setCookie)
            ? setCookie[0]
            : setCookie;
          expect(cookieHeader).toMatch(/access_token=/);
          expect(cookieHeader).toMatch(/HttpOnly/i);
        });
    });

    it('authenticates protected routes via cookie without Authorization header', async () => {
      const agent = request.agent(app.getHttpServer());

      await agent.post('/api/v1/auth/login').send(loginCredentials).expect(201);
      await agent.get('/api/v1/users').expect(200);
    });

    it('returns 401 for invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: validUser.email, password: 'wrong-password' })
        .expect(401)
        .expect((res) => {
          expect(res.body.error).toBe('Invalid credentials');
        });
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('clears the auth cookie and rejects subsequent cookie-based requests', async () => {
      const agent = request.agent(app.getHttpServer());

      await agent.post('/api/v1/auth/login').send(loginCredentials).expect(201);
      await agent.get('/api/v1/users').expect(200);

      const logoutResponse = await agent
        .post('/api/v1/auth/logout')
        .expect(201);

      expect(logoutResponse.body).toEqual({ ok: true });

      const setCookie = logoutResponse.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
      expect(cookieHeader).toMatch(/access_token=;/);

      await agent.get('/api/v1/users').expect(401);
    });
  });
});
