import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { Role } from '../../modules/roles/entities/role.entity';
import { Permission } from '../../modules/permissions/entities/permission.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AutoSeedService implements OnModuleInit {
  private readonly logger = new Logger(AutoSeedService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
  ) {}

  async onModuleInit() {
    try {
      await this.seedDefaultData();
    } catch (error) {
      this.logger.error(`Auto-seed failed: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  private async seedDefaultData() {
    // Check if admin user already exists
    const adminExists = await this.userRepository.findOne({
      where: { email: 'admin@sotetel.tn' },
    });

    if (adminExists) {
      this.logger.log('✅ Database already seeded, skipping auto-seed');
      return;
    }

    this.logger.log('🌱 Starting auto-seed...');

    // 1. Ensure super_admin role exists
    let superAdminRole = await this.roleRepository.findOne({
      where: { name: 'super_admin' },
      relations: ['permissions'],
    });

    if (!superAdminRole) {
      this.logger.log('📝 Creating super_admin role...');
      superAdminRole = this.roleRepository.create({ name: 'super_admin' });
      await this.roleRepository.save(superAdminRole);
    }

    // 2. Create default admin user
    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@sotetel.tn';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@123456';

    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const admin = this.userRepository.create({
      email: adminEmail,
      firstName: 'Super',
      lastName: 'Admin',
      password: hashedPassword,
      isActive: true,
      isEmailVerified: true,
      roles: [superAdminRole],
    });

    await this.userRepository.save(admin);
    this.logger.log(`✅ Created default admin user: ${adminEmail}`);
    this.logger.warn(`⚠️  Default password: ${adminPassword} — CHANGE THIS IMMEDIATELY!`);
  }
}
