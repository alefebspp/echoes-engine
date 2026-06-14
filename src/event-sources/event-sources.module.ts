import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventSource } from './event-source.entity';
import { EventSourcesService } from './event-sources.service';

@Module({
  imports: [TypeOrmModule.forFeature([EventSource])],
  providers: [EventSourcesService],
  exports: [EventSourcesService],
})
export class EventSourcesModule {}
