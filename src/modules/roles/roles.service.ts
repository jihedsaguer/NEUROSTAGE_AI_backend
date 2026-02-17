import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Role } from './entities/role.entity';
import { Permission } from '../permissions/entities/permission.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
    @InjectRepository(Permission)
    private permissionsRepository: Repository<Permission>,
  ) {}

  async create(createRoleDto: CreateRoleDto): Promise<Role> {
    const { name, description, permissionIds } = createRoleDto;

    const existing = await this.rolesRepository.findOne({ where: { name } });
    if (existing) {
      throw new ConflictException(`Role with name ${name} already exists`);
    }

    let permissions: Permission[] = [];
    if (permissionIds && permissionIds.length > 0) {
      permissions = await this.permissionsRepository.find({
        where: { id: In(permissionIds) },
      });
      if (permissions.length !== permissionIds.length) {
        throw new BadRequestException('One or more permissions not found');
      }
    }

    const role = this.rolesRepository.create({ name, description, permissions });
    return this.rolesRepository.save(role);
  }

  async findAll(): Promise<Role[]> {
    return this.rolesRepository.find({ relations: ['permissions'] });
  }

  async findOne(id: string): Promise<Role> {
    const role = await this.rolesRepository.findOne({ where: { id }, relations: ['permissions'] });
    if (!role) {
      throw new NotFoundException(`Role with id ${id} not found`);
    }
    return role;
  }

  async update(id: string, updateRoleDto: UpdateRoleDto): Promise<Role> {
    const role = await this.findOne(id);
    const { permissionIds, ...updateData } = updateRoleDto;

    if (permissionIds && permissionIds.length > 0) {
      const permissions = await this.permissionsRepository.find({
        where: { id: In(permissionIds) },
      });
      if (permissions.length !== permissionIds.length) {
        throw new BadRequestException('One or more permissions not found');
      }
      role.permissions = permissions;
    }

    Object.assign(role, updateData);
    return this.rolesRepository.save(role);
  }

  async remove(id: string): Promise<{ message: string }> {
    const role = await this.findOne(id);
    await this.rolesRepository.remove(role);
    return { message: `Role ${id} successfully deleted` };
  }

  async addPermissions(roleId: string, permissionIds: string[]): Promise<Role> {
    
    const role = await this.findOne(roleId);
    if(!role) {
      throw new NotFoundException(`Role with id ${roleId} not found`);
    }
    const permissions = await this.permissionsRepository.find({
      where: { id: In(permissionIds) },
    });
    if (permissions.length !== permissionIds.length) {
      throw new BadRequestException('One or more permissions not found');
    }
    const existingIds = role.permissions.map(p => p.id);
    
    const newPermissions = permissions.filter(p => !existingIds.includes(p.id));
    role.permissions = [...role.permissions, ...newPermissions];
    return this.rolesRepository.save(role);
  }
  }  
