import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { User } from '../src/users/user.entity';
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
    const usersRepository = app.get<Repository<User>>(getRepositoryToken(User));
    await usersRepository.createQueryBuilder().delete().from(User).execute();
    await app.close();
  });

  describe('POST /api/v1/auth/login', () => {
    it('returns a token for valid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(loginCredentials)
        .expect(201)
        .expect((res) => {
          expect(res.body.token).toEqual(expect.any(String));
          expect(res.body.token.length).toBeGreaterThan(0);
        });
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
});
