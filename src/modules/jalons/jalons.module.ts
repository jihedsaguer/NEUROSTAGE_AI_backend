import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JalonsController } from './jalons.controller';
import { JalonsService } from './jalons.service';
import { Jalon } from './entities/jalon.entity';
import { Livrable } from './entities/livrable.entity';
import { Stage } from '../stages/entities/stage.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Jalon, Livrable, Stage])],
  controllers: [JalonsController],
  providers: [JalonsService],
  exports: [JalonsService],
})
export class JalonsModule {}
