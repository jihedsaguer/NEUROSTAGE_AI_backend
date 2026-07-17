import { Module } from '@nestjs/common';
import{ CandidaturesService } from './candidatures.service';
import { CandidaturesController } from './candidatures.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Candidature } from './entities/candidature.entity';
import { Subject } from '../subjects/entities/subject.entity';
import { StagesModule } from '../stages/stages.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Candidature, Subject]),
    StagesModule,
  ],
  providers: [CandidaturesService],
  controllers: [CandidaturesController],
})
export class CandidaturesModule {}

