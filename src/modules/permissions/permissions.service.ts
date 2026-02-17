import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from './entities/permission.entity';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private permissionsRepository: Repository<Permission>,
  ) {}

  async create(dto: CreatePermissionDto): Promise<Permission> {
    const existing = await this.permissionsRepository.findOne({ where: { action: dto.action } });
    if (existing) {
      throw new ConflictException(`Permission with action ${dto.action} already exists`);
    }
    const perm = this.permissionsRepository.create(dto );
    return this.permissionsRepository.save(perm);
  }

  async findAll(): Promise<Permission[]> {
    return this.permissionsRepository.find();
  }

  async findOne(id: string): Promise<Permission> {
    const perm = await this.permissionsRepository.findOne({ where: { id } });
    if (!perm) {
      throw new NotFoundException(`Permission with id ${id} not found`);
    }
    return perm;
  }

  async update(id: string, dto: UpdatePermissionDto): Promise<Permission> {
    const perm = await this.findOne(id);
    Object.assign(perm, dto);
    return this.permissionsRepository.save(perm);
  }

  async remove(id: string): Promise<{ message: string }> {
    const perm = await this.findOne(id);
    await this.permissionsRepository.remove(perm);
    return { message: `Permission ${id} successfully deleted` };
  }
}
