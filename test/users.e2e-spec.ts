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
    email: 'jane@example.com',
    password: 'password123',
    name: 'Jane',
    surname: 'Doe',
  };

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    const usersRepository = app.get<Repository<User>>(getRepositoryToken(User));
    await usersRepository.createQueryBuilder().delete().from(User).execute();
    await app.close();
  });

  describe('POST /users', () => {
    it('creates a user without exposing the password', () => {
      return request(app.getHttpServer())
        .post('/users')
        .send(validUser)
        .expect(201)
        .expect((res) => {
          expect(res.body).toMatchObject({
            id: expect.any(Number),
            email: validUser.email,
            name: validUser.name,
            surname: validUser.surname,
          });
          expect(res.body.password).toBeUndefined();
        });
    });

    it('returns 400 when email is already registered', async () => {
      await request(app.getHttpServer()).post('/users').send(validUser);

      return request(app.getHttpServer())
        .post('/users')
        .send(validUser)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('Email already registered');
        });
    });

    it('returns 400 for invalid payload', () => {
      return request(app.getHttpServer())
        .post('/users')
        .send({ email: 'not-an-email', password: 'short' })
        .expect(400);
    });
  });

  describe('GET /users', () => {
    it('returns all users', async () => {
      await request(app.getHttpServer()).post('/users').send(validUser);

      return request(app.getHttpServer())
        .get('/users')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveLength(1);
          expect(res.body[0].email).toBe(validUser.email);
          expect(res.body[0].password).toBeUndefined();
        });
    });
  });

  describe('GET /users/:id', () => {
    it('returns a user by id', async () => {
      const { body: created } = await request(app.getHttpServer())
        .post('/users')
        .send(validUser);

      return request(app.getHttpServer())
        .get(`/users/${created.id}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(created.id);
          expect(res.body.password).toBeUndefined();
        });
    });

    it('returns 404 when user does not exist', () => {
      return request(app.getHttpServer()).get('/users/999').expect(404);
    });
  });

  describe('PATCH /users/:id', () => {
    it('updates a user', async () => {
      const { body: created } = await request(app.getHttpServer())
        .post('/users')
        .send(validUser);

      return request(app.getHttpServer())
        .patch(`/users/${created.id}`)
        .send({ name: 'Janet' })
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe('Janet');
          expect(res.body.surname).toBe(validUser.surname);
        });
    });
  });

  describe('DELETE /users/:id', () => {
    it('removes a user', async () => {
      const { body: created } = await request(app.getHttpServer())
        .post('/users')
        .send(validUser);

      await request(app.getHttpServer())
        .delete(`/users/${created.id}`)
        .expect(200);

      return request(app.getHttpServer()).get(`/users/${created.id}`).expect(404);
    });

    it('returns 404 when user does not exist', () => {
      return request(app.getHttpServer()).delete('/users/999').expect(404);
    });
  });
});
