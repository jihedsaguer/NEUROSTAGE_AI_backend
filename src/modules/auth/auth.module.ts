import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { ConfigModule,ConfigService } from '@nestjs/config';
import { forwardRef, Module } from '@nestjs/common';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { EmailModule } from '../email/email.module';

@Module({
    imports: [
      TypeOrmModule.forFeature([User, Role]),
      // use forwardRef to break circular dependency with EmailModule
      forwardRef(() => EmailModule),
      JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET is not defined');
        }
        const expiresIn = configService.get<string>('JWT_EXPIRES_IN') ?? '1h';

        return {
          secret,
          signOptions: {
            expiresIn: expiresIn as any,
          },
        };
      },
    })],
  controllers: [AuthController],
  providers: [AuthService,
    JwtStrategy,
    RolesGuard,
    PermissionsGuard
  ],
  exports: [JwtModule, AuthService],

})
export class AuthModule {}
