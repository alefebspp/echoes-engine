import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { UserOrmEntity } from '../src/infrastructure/typeorm/entities/user.entity';
import { createTestApp } from './create-test-app';

describe('UsersController (e2e)', () => {
  let app: INestApplication<App>;

  const validUser = {
    name: 'Jane',
    surname: 'Doe',
    email: 'jane@example.com',
    password: 'password123',
  };

  const loginCredentials = {
    email: validUser.email,
    password: validUser.password,
  };

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    const usersRepository = app.get<Repository<UserOrmEntity>>(getRepositoryToken(UserOrmEntity));
    await usersRepository.createQueryBuilder().delete().from(UserOrmEntity).execute();
    await app.close();
  });

  function createUser() {
    return request(app.getHttpServer()).post('/api/v1/users');
  }

  describe('POST /api/v1/users', () => {
    it('creates a user without exposing the password', () => {
      return createUser()
        .send(validUser)
        .expect(201)
        .expect((res) => {
          expect(res.body).toMatchObject({
            id: expect.any(String),
            name: validUser.name,
            surname: validUser.surname,
            email: validUser.email,
          });
          expect(res.body.password).toBeUndefined();
        });
    });

    it('returns 400 when email is already registered', async () => {
      await createUser().send(validUser).expect(201);

      return createUser()
        .send(validUser)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('Email already registered');
        });
    });

    it('returns 400 for invalid payload', () => {
      return createUser()
        .send({ email: 'not-an-email', password: 'short' })
        .expect(400);
    });
  });

  describe('authenticated routes', () => {
    let token: string;
    let userId: string;

    beforeEach(async () => {
      const { body } = await createUser().send(validUser).expect(201);
      userId = body.id;

      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(loginCredentials);
      token = loginResponse.body.token;
    });

    function authenticated() {
      const server = app.getHttpServer();
      return {
        get: (url: string) =>
          request(server).get(url).set('Authorization', `Bearer ${token}`),
        patch: (url: string) =>
          request(server).patch(url).set('Authorization', `Bearer ${token}`),
        delete: (url: string) =>
          request(server).delete(url).set('Authorization', `Bearer ${token}`),
      };
    }

    describe('GET /api/v1/users', () => {
      it('returns all users', () => {
        return authenticated()
          .get('/api/v1/users')
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveLength(1);
            expect(res.body[0].email).toBe(validUser.email);
            expect(res.body[0].password).toBeUndefined();
          });
      });
    });

    describe('GET /api/v1/users/me', () => {
      it('returns the authenticated user via bearer token', () => {
        return authenticated()
          .get('/api/v1/users/me')
          .expect(200)
          .expect((res) => {
            expect(res.body).toMatchObject({
              id: userId,
              name: validUser.name,
              surname: validUser.surname,
              email: validUser.email,
            });
            expect(res.body.password).toBeUndefined();
          });
      });

      it('returns the authenticated user via cookie', async () => {
        const agent = request.agent(app.getHttpServer());

        await agent.post('/api/v1/auth/login').send(loginCredentials).expect(201);

        const response = await agent.get('/api/v1/users/me').expect(200);

        expect(response.body).toMatchObject({
          id: userId,
          email: validUser.email,
        });
        expect(response.body.password).toBeUndefined();
      });

      it('returns 401 when unauthenticated', () => {
        return request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
      });
    });

    describe('GET /api/v1/users/:id', () => {
      it('returns a user by id', () => {
        return authenticated()
          .get(`/api/v1/users/${userId}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.id).toBe(userId);
            expect(res.body.password).toBeUndefined();
          });
      });

      it('returns 404 when user does not exist', () => {
        return authenticated()
          .get('/api/v1/users/550e8400-e29b-41d4-a716-446655440099')
          .expect(404);
      });
    });

    describe('PATCH /api/v1/users/:id', () => {
      it('updates a user', () => {
        return authenticated()
          .patch(`/api/v1/users/${userId}`)
          .send({ name: 'Janet', surname: 'Smith', email: 'janet@example.com' })
          .expect(200)
          .expect((res) => {
            expect(res.body.name).toBe('Janet');
            expect(res.body.surname).toBe('Smith');
            expect(res.body.email).toBe('janet@example.com');
          });
      });
    });

    describe('DELETE /api/v1/users/:id', () => {
      it('removes a user', async () => {
        await authenticated().delete(`/api/v1/users/${userId}`).expect(200);

        return authenticated().get(`/api/v1/users/${userId}`).expect(404);
      });

      it('returns 404 when user does not exist', () => {
        return authenticated()
          .delete('/api/v1/users/550e8400-e29b-41d4-a716-446655440099')
          .expect(404);
      });
    });
  });
});
