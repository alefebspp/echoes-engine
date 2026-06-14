import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventSourcesModule } from '../event-sources/event-sources.module';
import { EventTagsModule } from '../event-tags/event-tags.module';
import { Event } from './event.entity';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event]),
    EventSourcesModule,
    EventTagsModule,
  ],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
