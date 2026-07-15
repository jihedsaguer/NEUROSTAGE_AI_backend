import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { StudentProfile } from '../profiles/entities/profiles.entity';
import { SYSTEM_ROLES } from '../roles/constants/roles.constants';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
    @InjectRepository(StudentProfile)
    private profilesRepository: Repository<StudentProfile>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const { email, password, roleIds, ...userData } = createUserDto;

    // Check if user already exists
    const existingUser = await this.usersRepository.findOne({ where: { email } });
    if (existingUser) {
      throw new ConflictException(`User with email ${email} already exists`);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Fetch roles if provided
    let roles: Role[] = [];
    if (roleIds && roleIds.length > 0) {
      roles = await this.rolesRepository.find({
        where: roleIds.map((id) => ({ id })),
      });

      if (roles.length !== roleIds.length) {
        throw new BadRequestException('One or more roles not found');
      }
    }

    // Create user
    const user = this.usersRepository.create({
      ...userData,
      email,
      password: hashedPassword,
      roles,
    });

    return this.usersRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({
      relations: ['roles', 'roles.permissions'],
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    const { password, roleIds, ...updateData } = updateUserDto;

    // Hash new password if provided
    if (password) {
      updateData['password'] = await bcrypt.hash(password, 10);
    }

    // Update roles if provided
    if (roleIds && roleIds.length > 0) {
      const roles = await this.rolesRepository.find({
        where: roleIds.map((id) => ({ id })),
      });

      if (roles.length !== roleIds.length) {
        throw new BadRequestException('One or more roles not found');
      }

      user.roles = roles;
    }

    Object.assign(user, updateData);
    return this.usersRepository.save(user);
  }

  async remove(id: string): Promise<{ message: string }> {
    const user = await this.findOne(id);
    await this.usersRepository.remove(user);
    return { message: `User ${id} successfully deleted` };
  }

  async validatePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  /**
   * Returns basic info for all active users — used by the chat participant selector.
   * Intentionally lightweight: no passwords, no permissions, no full role objects.
   */
  async getChatParticipants(): Promise<
    { id: string; firstName: string; lastName: string; email: string; role: string | null }[]
  > {
    const users = await this.usersRepository.find({
      where: { isActive: true },
      relations: ['roles'],
      select: ['id', 'firstName', 'lastName', 'email'],
    });

    return users.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: u.roles?.[0]?.name ?? null,
    }));
  }

  /**
   * Returns only students whose CV has been AI-processed (isAiProcessed = true).
   * Used by encadreur_pro to pick students for subject draft generation.
   * Uses a native query to avoid TypeORM camelCase/varchar-vs-uuid join issues.
   */
  async findStudentsWithEmbeddings(): Promise<
    {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      university: string | null;
      level: string | null;
      skills: string[];
      isAiProcessed: boolean;
    }[]
  > {
    // Use a raw query to sidestep the varchar/uuid type mismatch that TypeORM
    // doesn't cast automatically when the FK is stored as varchar.
    const rows: Array<{
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      university: string | null;
      level: string | null;
      skills: string[];
      isAiProcessed: boolean;
    }> = await this.usersRepository.query(
      `
      SELECT
        u.id,
        u."firstName",
        u."lastName",
        u.email,
        sp.university,
        sp.level,
        sp.skills,
        sp."isAiProcessed"
      FROM users u
      INNER JOIN student_profiles sp ON sp."userId" = u.id::text
      INNER JOIN user_roles ur ON ur.user_id = u.id
      INNER JOIN roles r ON r.id = ur.role_id
      WHERE r.name = $1
        AND sp."isAiProcessed" = true
        AND u."isActive" = true
      `,
      [SYSTEM_ROLES.STUDENT],
    );

    return rows.map((row) => ({
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      university: row.university ?? null,
      level: row.level ?? null,
      skills: Array.isArray(row.skills) ? row.skills : [],
      isAiProcessed: row.isAiProcessed,
    }));
  }
}
