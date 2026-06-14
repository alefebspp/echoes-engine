import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { User } from '../src/users/user.entity';
import { createTestApp } from './create-test-app';

describe('UsersController (e2e)', () => {
  let app: INestApplication<App>;

  const validUser = {
    name: 'Jane',
    surname: 'Doe',
    email: 'jane@example.com',
    password: 'password123',
  };

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    const usersRepository = app.get<Repository<User>>(getRepositoryToken(User));
    await usersRepository.createQueryBuilder().delete().from(User).execute();
    await app.close();
  });

  describe('POST /api/v1/users', () => {
    it('creates a user without exposing the password', () => {
      return request(app.getHttpServer())
        .post('/api/v1/users')
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
      await request(app.getHttpServer()).post('/api/v1/users').send(validUser);

      return request(app.getHttpServer())
        .post('/api/v1/users')
        .send(validUser)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('Email already registered');
        });
    });

    it('returns 400 for invalid payload', () => {
      return request(app.getHttpServer())
        .post('/api/v1/users')
        .send({ email: 'not-an-email', password: 'short' })
        .expect(400);
    });
  });

  describe('GET /api/v1/users', () => {
    it('returns all users', async () => {
      await request(app.getHttpServer()).post('/api/v1/users').send(validUser);

      return request(app.getHttpServer())
        .get('/api/v1/users')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveLength(1);
          expect(res.body[0].email).toBe(validUser.email);
          expect(res.body[0].password).toBeUndefined();
        });
    });
  });

  describe('GET /api/v1/users/:id', () => {
    it('returns a user by id', async () => {
      const { body: created } = await request(app.getHttpServer())
        .post('/api/v1/users')
        .send(validUser);

      return request(app.getHttpServer())
        .get(`/api/v1/users/${created.id}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(created.id);
          expect(res.body.password).toBeUndefined();
        });
    });

    it('returns 404 when user does not exist', () => {
      return request(app.getHttpServer())
        .get('/api/v1/users/550e8400-e29b-41d4-a716-446655440099')
        .expect(404);
    });
  });

  describe('PATCH /api/v1/users/:id', () => {
    it('updates a user', async () => {
      const { body: created } = await request(app.getHttpServer())
        .post('/api/v1/users')
        .send(validUser);

      return request(app.getHttpServer())
        .patch(`/api/v1/users/${created.id}`)
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
      const { body: created } = await request(app.getHttpServer())
        .post('/api/v1/users')
        .send(validUser);

      await request(app.getHttpServer())
        .delete(`/api/v1/users/${created.id}`)
        .expect(200);

      return request(app.getHttpServer())
        .get(`/api/v1/users/${created.id}`)
        .expect(404);
    });

    it('returns 404 when user does not exist', () => {
      return request(app.getHttpServer())
        .delete('/api/v1/users/550e8400-e29b-41d4-a716-446655440099')
        .expect(404);
    });
  });
});
