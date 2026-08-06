import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AlsModule } from './common/async-context/als.module';
import { RequestContextStore } from './common/async-context/request-context.store';
import { LoggerModule } from './common/logging/logger.module';
import { AuthModule } from './presentation/auth/auth.module';
import { DashboardModule } from './presentation/dashboard/dashboard.module';
import { EventModule } from './presentation/event/event.module';
import { UserModule } from './presentation/user/user.module';
import { EnrichmentQueueModule } from './infrastructure/queue/enrichment-queue.module';

@Module({
  imports: [
    AlsModule,
    LoggerModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60_000,
          limit: 10,
        },
      ],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: parseInt(configService.get<string>('DB_PORT', '5432'), 10),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'postgres'),
        database: configService.get<string>('DB_DATABASE', 'echoes'),
        autoLoadEntities: true,
        synchronize: configService.get<string>('PROJECT_ENV') !== 'production',
        ssl:
          configService.get('DB_SSL') === 'true'
            ? { rejectUnauthorized: false }
            : false,
      }),
    }),
    UserModule,
    AuthModule,
    EventModule,
    EnrichmentQueueModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  constructor(
    @Inject(AsyncLocalStorage)
    private readonly als: AsyncLocalStorage<RequestContextStore>,
  ) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply((req: Request, res: Response, next: NextFunction) => {
        const headerValue = req.headers['x-correlation-id'];
        const correlationId =
          typeof headerValue === 'string' && headerValue.length > 0
            ? headerValue
            : randomUUID();

        res.setHeader('x-correlation-id', correlationId);
        this.als.run({ correlationId }, () => next());
      })
      .forRoutes('*path');
  }
}
