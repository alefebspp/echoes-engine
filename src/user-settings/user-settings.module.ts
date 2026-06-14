import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSettings } from './user-settings.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserSettings])],
})
export class UserSettingsModule {}
