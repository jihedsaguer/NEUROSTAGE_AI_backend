import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { JwtPayload } from '../types/jwt-payload.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined in .env');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

    async validate(payload: JwtPayload) {

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }

    const permissions = user.roles
      .flatMap(r => r.permissions?.map(p => p.action) ?? []);
    const uniquePermissions = Array.from(new Set(permissions));

    // Attach derived fields so controllers and the future WebSocket gateway
    // can read them without an extra DB query.
    (user as any).roles = user.roles; // already loaded with relations
    (user as any).permissions = uniquePermissions;

    return user as any;
  }
}
