import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { Role } from 'src/modules/roles/entities/role.entity';
import { NotFoundException } from '@nestjs/common';
import { UserResponseDto } from './dto/user-response.dto';
import { plainToInstance } from 'class-transformer';
import { SYSTEM_ROLES } from '../roles/constants/roles.constants';
import { InternalServerErrorException } from '@nestjs/common';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './types/jwt-payload.type';
import { EmailService } from '../email/email.service';
import { Inject, forwardRef } from '@nestjs/common';

@Injectable()
export class AuthService {
    constructor(
    @InjectRepository(User) 
     private   readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private  readonly roleRepository: Repository<Role>,
    private readonly jwtService: JwtService,
    @Inject(forwardRef(() => EmailService))
    private readonly emailService: EmailService
    ) {}


async register(registerDto: RegisterDto): Promise<UserResponseDto> {
  const { email, password, firstName, lastName } = registerDto;

  const existingUser = await this.userRepository.findOne({
    where: { email },
  });

  if (existingUser) {
    throw new ConflictException('Email already exists');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const defaultRole = await this.roleRepository.findOne({
    where: { name: SYSTEM_ROLES.STUDENT },
  });

  if (!defaultRole) {
    throw new InternalServerErrorException(
      'Default role configuration error',
    );
  }

  
  const user = this.userRepository.create({
    email,
    password: hashedPassword,
    firstName,
    lastName,
    isActive: true,
    roles: [defaultRole],
  });
await this.generateEmailVerificationToken(user);
  await this.userRepository.save(user);

  const savedUser = await this.userRepository.findOne({
    where: { id: user.id },
    relations: ['roles'],
  });

  return plainToInstance(UserResponseDto, savedUser, {
    excludeExtraneousValues: true,
  });
}
async validateUser(email: string, password: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User is inactive');
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;
    const user = await this.validateUser(email, password);

    // determine primary role and flatten permissions
    const role = user.roles && user.roles.length > 0 ? user.roles[0].name : '';
    const permissions = user.roles
      .flatMap(r => r.permissions?.map(p => p.action) ?? []);
    const uniquePermissions = Array.from(new Set(permissions));
     // check isEmailVerified before allowing login
    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Email is not verified');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role,
      permissions: uniquePermissions,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.setRefreshToken(user);

    const userDto = plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });

    return plainToInstance(AuthResponseDto, {
      user: userDto,
      accessToken,
      refreshToken,
    }, { excludeExtraneousValues: true });
  }
    

  async generateEmailVerificationToken(user: User): Promise<string> {
    const token = require('crypto').randomBytes(32).toString('hex');
    user.emailVerificationToken = token;
    user.emailVerificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.userRepository.save(user);

    try {
      await this.emailService.sendVerificationEmail(user, token);
    } catch (err) {
      console.error('Failed to send verification email', err);
    }

    return token;
  }

  async verifyEmail(token: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { emailVerificationToken: token },
    });
    if (!user) {
      throw new NotFoundException('Invalid verification token');
    }
    if (user.emailVerificationTokenExpires && user.emailVerificationTokenExpires < new Date()) {
      throw new NotFoundException('Verification token has expired');
    }
    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationTokenExpires = null;
    await this.userRepository.save(user);
  }

 
  private async setRefreshToken(user: User): Promise<string> {
    const token = require('crypto').randomBytes(64).toString('hex');
    user.refreshToken = token;
    user.refreshTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.userRepository.save(user);
    return token;
  }


  async refreshToken(oldRefreshToken: string): Promise<AuthResponseDto> {
    const user = await this.userRepository.findOne({
      where: { refreshToken: oldRefreshToken },
      relations: ['roles', 'roles.permissions'],
    });
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (user.refreshTokenExpires && user.refreshTokenExpires < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // generate new access token+refresh token
    const role = user.roles && user.roles.length > 0 ? user.roles[0].name : '';
    const permissions = user.roles
      .flatMap(r => r.permissions?.map(p => p.action) ?? []);
    const uniquePermissions = Array.from(new Set(permissions));

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role,
      permissions: uniquePermissions,
    };

    const accessToken = this.jwtService.sign(payload);
    const refresh = await this.setRefreshToken(user);

    const userDto = plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });

    return plainToInstance(AuthResponseDto, {
      user: userDto,
      accessToken,
      refreshToken: refresh,
    }, { excludeExtraneousValues: true });
  }

 
  async logout(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user) {
      user.refreshToken = null;
      user.refreshTokenExpires = null;
      await this.userRepository.save(user);
    }
  }


async resendVerificationEmail(email: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { email },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.isEmailVerified) {
      throw new ConflictException('Email is already verified');
    }
    await this.setRefreshToken(user); // ensure refresh token persists
    const token = await this.generateEmailVerificationToken(user);
    return;
  }
}