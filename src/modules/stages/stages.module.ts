import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StagesController } from './stages.controller';
import { StagesService } from './stages.service';
import { Stage } from './entities/stage.entity';
import { Candidature } from '../candidatures/entities/candidature.entity';
import { User } from '../users/entities/user.entity';
import { Subject } from '../subjects/entities/subject.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Stage, Candidature, User, Subject])],
  controllers: [StagesController],
  providers: [StagesService],
  exports: [StagesService],
})
export class StagesModule {}
