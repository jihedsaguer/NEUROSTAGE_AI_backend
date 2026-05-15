import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { StudentProfile } from './entities/profiles.entity';
import { StudentDocument } from './entities/student-document.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StudentProfile, StudentDocument])],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
