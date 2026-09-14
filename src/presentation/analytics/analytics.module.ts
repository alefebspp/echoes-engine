import { Module } from '@nestjs/common';
import { ReadModelsModule } from '../read-models/read-models.module';
import { AnalyticsController } from './analytics.controller';

@Module({
  imports: [ReadModelsModule],
  controllers: [AnalyticsController],
})
export class AnalyticsModule {}
