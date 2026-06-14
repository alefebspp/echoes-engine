import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventTag } from './event-tag.entity';
import { EventTagsService } from './event-tags.service';

@Module({
  imports: [TypeOrmModule.forFeature([EventTag])],
  providers: [EventTagsService],
  exports: [EventTagsService],
})
export class EventTagsModule {}
