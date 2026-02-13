import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './modules/users/entities/user.entity';
import { Role } from './modules/roles/entities/role.entity';
import { Permission } from './modules/permissions/entities/permission.entity';
import { Assignment } from './modules/assignments/entities/assignment.entity';
import { getDatabaseConfig } from '../config/database.config';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
     TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        getDatabaseConfig(configService),
    }),
        TypeOrmModule.forFeature([User, Role, Permission, Assignment]),

  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
