import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubjectsController } from './subjects.controller';
import { SubjectsService } from './subjects.service';
import { Subject } from './entities/subject.entity';
import { GenerationIA } from '../ai/entities/generation-ia.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Subject, GenerationIA])],
  controllers: [SubjectsController],
  providers: [SubjectsService],
  exports: [SubjectsService],
})
export class SubjectsModule {}
