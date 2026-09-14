import { Module } from '@nestjs/common';
import { ReadModelsModule } from '../read-models/read-models.module';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [ReadModelsModule],
  controllers: [DashboardController],
})
export class DashboardModule {}
