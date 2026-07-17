import { Logger, Module, NestModule, MiddlewareConsumer, OnModuleInit } from '@nestjs/common';
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
import { JalonsModule } from './modules/jalons/jalons.module';
import { ChatModule } from './modules/chat/chat.module';
import { RagModule } from './modules/rag/rag.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SubjectsService } from './modules/subjects/subjects.service';

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
    JalonsModule,
    ChatModule,
    RagModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    LoggerService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule implements NestModule, OnModuleInit {
  private readonly logger = new Logger(AppModule.name);

  constructor(private readonly subjectsService: SubjectsService) {}

  async onModuleInit() {
    void this.warmupValidatedSubjects();
  }

  private async warmupValidatedSubjects() {
    try {
      const subjects = await this.subjectsService.getValidatedSubjects();
      if (!subjects?.length) {
        return;
      }

      const AI_SERVICE_URL = process.env.AI_SERVICE_URL;
      const INTERNAL_SECRET = process.env.INTERNAL_SECRET;
      if (!AI_SERVICE_URL || !INTERNAL_SECRET) {
        return;
      }

      const fetchFn = (globalThis as any).fetch ?? (await import('node-fetch')).default;
      const response = await fetchFn(`${AI_SERVICE_URL.replace(/\/$/, '')}/embed/subjects/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': INTERNAL_SECRET,
        },
        body: JSON.stringify({
          subjects: subjects.map((subject: any) => ({
            subjectId: subject.id,
            titre: subject.title,
            description: subject.description,
            techno: subject.technologies ?? [],
            prerequis: subject.prerequisites ?? '',
            niveau: subject.level ?? '',
          })),
        }),
      });

      if (!response.ok) {
        this.logger.warn(`Bulk subject warmup returned ${response.status}`);
      }
    } catch (err) {
      this.logger.warn(`Bulk subject warmup failed: ${(err as Error).message}`);
    }
  }

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
