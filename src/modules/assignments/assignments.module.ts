import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Assignment } from './entities/assignment.entity';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Assignment,User])],
  controllers : [AssignmentsController],
  providers: [AssignmentsService],
  exports: [TypeOrmModule, AssignmentsService],
})
export class AssignmentsModule {}
