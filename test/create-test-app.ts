import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/infrastructure/nest/validation-pipe';
import { flushTestRedis } from './flush-test-redis';

export async function createTestApp(): Promise<INestApplication> {
  await flushTestRedis();

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(createValidationPipe());
  await app.init();
  return app;
}
