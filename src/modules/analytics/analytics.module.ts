import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { User } from '../users/entities/user.entity';
import { StudentProfile } from '../profiles/entities/profiles.entity';
import { Subject } from '../subjects/entities/subject.entity';
import { Candidature } from '../candidatures/entities/candidature.entity';
import { Stage } from '../stages/entities/stage.entity';
import { Jalon } from '../jalons/entities/jalon.entity';
import { Livrable } from '../jalons/entities/livrable.entity';
import { GenerationIA } from '../ai/entities/generation-ia.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      StudentProfile,
      Subject,
      Candidature,
      Stage,
      Jalon,
      Livrable,
      GenerationIA,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
