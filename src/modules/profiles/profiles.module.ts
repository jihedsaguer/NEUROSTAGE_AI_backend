import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { ProfilesController } from './profiles.controller';
import { InternalProfilesController } from './internal.controller';
import { ProfilesService } from './profiles.service';
import { StudentProfile } from './entities/profiles.entity';
import { StudentDocument } from './entities/student-document.entity';
import {
  StorageService,
  createMulterOptions,
} from './storage/storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([StudentProfile, StudentDocument]),
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        createMulterOptions(configService),
    }),
  ],
  controllers: [ProfilesController, InternalProfilesController],
  providers: [ProfilesService, StorageService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
