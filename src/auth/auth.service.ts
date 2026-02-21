import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../modules/users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { Role } from 'src/modules/roles/entities/role.entity';
import { NotFoundException } from '@nestjs/common';
import { UserResponseDto } from './dto/user-response.dto';
import { plainToInstance } from 'class-transformer';
import { SYSTEM_ROLES } from '../modules/roles/constants/roles.constants';
import { InternalServerErrorException } from '@nestjs/common';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
    constructor(
    @InjectRepository(User) 
     private   readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private  readonly roleRepository: Repository<Role>,
    private readonly jwtService: JwtService
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

  await this.userRepository.save(user);

  const savedUser = await this.userRepository.findOne({
    where: { id: user.id },
    relations: ['roles'],
  });

  return plainToInstance(UserResponseDto, savedUser, {
    excludeExtraneousValues: true,
  });
}

    async login(loginDto: LoginDto): Promise<AuthResponseDto> {
  const { email, password } = loginDto;

  const user = await this.userRepository.findOne({
    where: { email },
    relations: ['roles'],
  });

  if (!user) {
    throw new UnauthorizedException('Invalid credentials');
  }

  const isPasswordValid = await bcrypt.compare(
    password,
    user.password,
  );

  if (!isPasswordValid) {
    throw new UnauthorizedException('Invalid credentials');
  }

  if (!user.isActive) {
    throw new UnauthorizedException('User account is inactive');
  }

  // Build JWT payload
  const payload = {
    sub: user.id,
    email: user.email,
    roles: user.roles.map((role) => role.name),
  };

  const accessToken = await this.jwtService.signAsync(payload);

  const userResponse = plainToInstance(UserResponseDto, user, {
    excludeExtraneousValues: true,
  });

  return plainToInstance(
    AuthResponseDto,
    {
      user: userResponse,
      accessToken,
    },
    { excludeExtraneousValues: true },
  );
}

}