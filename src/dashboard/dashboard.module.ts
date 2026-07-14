import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventTag } from '../event-tags/event-tag.entity';
import { EventOrmEntity } from '../infrastructure/typeorm/entities/event.entity';
import { UserSettings } from '../user-settings/user-settings.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([EventOrmEntity, EventTag, UserSettings])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
