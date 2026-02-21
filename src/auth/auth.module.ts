import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../modules/users/entities/user.entity';
import { Role } from '../modules/roles/entities/role.entity';
import { ConfigModule,ConfigService } from '@nestjs/config';

@Module({
    imports: [TypeOrmModule.forFeature([User, Role]),
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
  providers: [AuthService],
  exports: [JwtModule],

})
export class AuthModule {}
