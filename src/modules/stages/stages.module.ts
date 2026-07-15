import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StagesController } from './stages.controller';
import { StagesService } from './stages.service';
import { Stage } from './entities/stage.entity';
import { Candidature } from '../candidatures/entities/candidature.entity';
import { User } from '../users/entities/user.entity';
import { Subject } from '../subjects/entities/subject.entity';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Stage, Candidature, User, Subject]),
    // forwardRef to break the circular dependency:
    // StagesModule → ChatModule → (no dependency on StagesModule)
    forwardRef(() => ChatModule),
  ],
  controllers: [StagesController],
  providers: [StagesService],
  exports: [StagesService],
})
export class StagesModule {}
