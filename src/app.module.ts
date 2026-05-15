import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDatabaseConfig } from '../config/database.config';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { AuthModule } from './modules/auth/auth.module';
import { EmailModule } from './modules/email/email.module';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { LoggerService } from './common/logger/logger.service';
import { AuditModule } from './common/audit/audit.module';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { CandidaturesModule } from './modules/candidatures/candidatures.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { StagesModule } from './modules/stages/stages.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';
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
    AuditModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    AssignmentsModule,
    AuthModule,
    EmailModule,
    SubjectsModule,
    CandidaturesModule,
    ProfilesModule,
    StagesModule,
  ],
  controllers: [AppController],
  providers: [AppService, LoggerService,
    {
    provide: APP_INTERCEPTOR,
    useClass: AuditInterceptor,
  },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
