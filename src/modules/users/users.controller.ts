import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SYSTEM_ROLES } from '../roles/constants/roles.constants';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ADMIN_FORMATION)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  async findAll() {
    return this.usersService.findAll();
  }

  /**
   * GET /users/students/with-embeddings
   * Returns students who have AI-processed CVs (isAiProcessed = true).
   * Used by encadreur_pro to pick students for subject draft generation.
   * Must be declared BEFORE :id route to avoid param collision.
   */
  @Get('students/with-embeddings')
  @Roles(
    SYSTEM_ROLES.ENCADRANT_PRO,
    SYSTEM_ROLES.ADMIN_FORMATION,
    SYSTEM_ROLES.SUPER_ADMIN,
  )
  async findStudentsWithEmbeddings() {
    return this.usersService.findStudentsWithEmbeddings();
  }

  /**
   * GET /users/chat-participants
   * Returns basic user info (id, name, email, role) for all active users.
   * Used by the chat room participant selector — available to all authenticated roles.
   * Must be declared BEFORE :id route to avoid the UUID param catching it.
   */
  @Get('chat-participants')
  @Roles(
    SYSTEM_ROLES.SUPER_ADMIN,
    SYSTEM_ROLES.ADMIN_FORMATION,
    SYSTEM_ROLES.ENCADRANT_PRO,
    SYSTEM_ROLES.ENCADRANT_ACADEMIQUE,
    SYSTEM_ROLES.STUDENT,
  )
  async getChatParticipants() {
    return this.usersService.getChatParticipants();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
