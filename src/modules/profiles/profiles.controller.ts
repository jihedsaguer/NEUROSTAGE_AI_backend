import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  BadRequestException,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProfilesService } from './profiles.service';
import {
  CreateProfileDto,
  UpdateProfileDto,
  UploadDocumentDto,
  ProfileResponseDto,
  DocumentResponseDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SYSTEM_ROLES } from '../roles/constants/roles.constants';
import { Audit } from 'src/common/audit/audit.decorator';
import { PaginatedResponseDto } from 'src/common/dto';

@Controller('profiles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  /**
   * GET /profiles/me
   * Get current user's profile (or create if doesn't exist)
   */
  @Get('me')
  @Roles(SYSTEM_ROLES.STUDENT)
  async getMyProfile(@Request() req): Promise<ProfileResponseDto> {
    return await this.profilesService.getOrCreateProfile(req.user);
  }

  /**
   * POST /profiles
   * Create profile for current user
   */
  @Post()
  @Roles(SYSTEM_ROLES.STUDENT)
  @Audit('CREATE_PROFILE', 'Profile')
  async createProfile(
    @Request() req,
    @Body() createProfileDto: CreateProfileDto,
  ): Promise<ProfileResponseDto> {
    await this.profilesService.getOrCreateProfile(req.user);

    return await this.profilesService.updateProfile(
      req.user.id,
      createProfileDto,
    );
  }

  /**
   * PATCH /profiles
   * Update current user's profile
   */
  @Patch()
  @Roles(SYSTEM_ROLES.STUDENT)
  @Audit('UPDATE_PROFILE', 'Profile')
  async updateProfile(
    @Request() req,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    return await this.profilesService.updateProfile(
      req.user.id,
      updateProfileDto,
    );
  }

  /**
   * POST /profiles/documents
   * Upload document file (multipart: type + file)
   */
  @Post('documents')
  @Roles(SYSTEM_ROLES.STUDENT)
  @Audit('UPLOAD_DOCUMENT', 'Document')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Request() req,
    @Body() uploadDocumentDto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<DocumentResponseDto> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    return await this.profilesService.uploadDocument(
      req.user.id,
      uploadDocumentDto.type,
      file,
    );
  }

  /**
   * GET /profiles/documents
   * Get all documents for current user
   * Query params: limit, offset, type (filter by type)
   */
  @Get('documents')
  @Roles(SYSTEM_ROLES.STUDENT)
  async getDocuments(
    @Request() req,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
    @Query('type') type?: string,
  ): Promise<PaginatedResponseDto<DocumentResponseDto>> {
    if (limit && (limit < 1 || limit > 100)) {
      throw new BadRequestException('Limit must be between 1 and 100');
    }

    if (offset && offset < 0) {
      throw new BadRequestException('Offset must be >= 0');
    }

    return await this.profilesService.getDocuments(
      req.user.id,
      limit || 20,
      offset || 0,
      type,
    );
  }

  /**
   * GET /profiles/me/subject-suggestions
   * Returns AI-driven subject suggestions for the current student.
   */
  @Get('me/subject-suggestions')
  @Roles(SYSTEM_ROLES.STUDENT)
  async getSubjectSuggestions(@Request() req) {
    return await this.profilesService.getSubjectSuggestions(req.user.id);
  }

  /**
   * DELETE /profiles/documents/:id
   * Delete a document (only owner can delete)
   */
  @Delete('documents/:id')
  @Roles(SYSTEM_ROLES.STUDENT)
  @Audit('DELETE_DOCUMENT', 'Document')
  async deleteDocument(
    @Param('id') documentId: string,
    @Request() req,
  ): Promise<{ message: string }> {
    await this.profilesService.deleteDocument(documentId, req.user.id);
    return { message: 'Document deleted successfully' };
  }
}
