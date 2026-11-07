import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppLogger } from './common/logging/app-logger.service';
import { createValidationPipe } from './infrastructure/nest/validation-pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(await app.resolve(AppLogger));
  const isProduction = process.env.NODE_ENV === 'production';

  app.enableCors({
    origin: isProduction
      ? (process.env.CORS_ORIGIN?.split(',')
          .map((origin) => origin.trim())
          .filter(Boolean) ?? false)
      : true,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(createValidationPipe());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
