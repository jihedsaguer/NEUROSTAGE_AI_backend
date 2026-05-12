import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudentProfile } from './entities/profiles.entity';
import { StudentDocument } from './entities/student-document.entity';
import { User } from '../users/entities/user.entity';
import {
  CreateProfileDto,
  UpdateProfileDto,
  UploadDocumentDto,
  ProfileResponseDto,
  DocumentResponseDto,
} from './dto';
import { PaginatedResponseDto } from 'src/common/dto';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(StudentProfile)
    private readonly profileRepository: Repository<StudentProfile>,
    @InjectRepository(StudentDocument)
    private readonly documentRepository: Repository<StudentDocument>,
  ) {}

  /**
   * Get or create profile for user
   * This is called when user first accesses profiles
   */
  async getOrCreateProfile(user: User): Promise<ProfileResponseDto> {
    // Check if profile exists
    let profile = await this.profileRepository.findOne({
      where: { userId: user.id },
    });

    // If no profile, create one
    if (!profile) {
      profile = this.profileRepository.create({
        userId: user.id,
        skills: [],
        completionPercentage: 0,
        isComplete: false,
        cinStatus: 'PENDING',
        isAiProcessed: false,
      } as Partial<StudentProfile>);

      profile = await this.profileRepository.save(profile);
    }

    return this.mapProfileToResponse(profile);
  }

  /**
   * Get current user's profile
   */
  async getProfile(userId: string): Promise<ProfileResponseDto> {
    const profile = await this.profileRepository.findOne({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found for this user');
    }

    return this.mapProfileToResponse(profile);
  }

  /**
   * Update user's profile
   */
  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    const profile = await this.profileRepository.findOne({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found for this user');
    }

    // Update fields if provided
    if (updateProfileDto.phone !== undefined) {
      profile.phone = updateProfileDto.phone;
    }
    if (updateProfileDto.university !== undefined) {
      profile.university = updateProfileDto.university;
    }
    if (updateProfileDto.level !== undefined) {
      profile.level = updateProfileDto.level;
    }
    if (updateProfileDto.graduationYear !== undefined) {
      profile.graduationYear = updateProfileDto.graduationYear;
    }
    if (updateProfileDto.skills !== undefined) {
      profile.skills = updateProfileDto.skills;
    }
    if (updateProfileDto.cinLast3Digits !== undefined) {
      profile.cinLast3Digits = updateProfileDto.cinLast3Digits;
    }
    if (updateProfileDto.cinStatus !== undefined) {
      profile.cinStatus = updateProfileDto.cinStatus;
    }

    // Recalculate completion percentage (check if CV exists)
    const hasCv = await this.hasCvDocument(profile.id);
    const completionPercentage = this.calculateCompletionPercentage(
      profile,
      hasCv,
    );
    profile.completionPercentage = completionPercentage;
    profile.isComplete = completionPercentage > 80;

    const updatedProfile = await this.profileRepository.save(profile);

    return this.mapProfileToResponse(updatedProfile);
  }

  /**
   * Upload document metadata
   * (In real implementation, this would handle actual file uploads)
   */
  async uploadDocument(
    userId: string,
    uploadDocumentDto: UploadDocumentDto,
  ): Promise<DocumentResponseDto> {
    // Get user's profile
    const profile = await this.profileRepository.findOne({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found for this user');
    }

    // Validate document type
    const validTypes = ['CV', 'TRANSCRIPT', 'CERTIFICATE', 'CIN', 'OTHER'];
    if (!validTypes.includes(uploadDocumentDto.type)) {
      throw new BadRequestException(
        `Invalid document type. Allowed: ${validTypes.join(', ')}`,
      );
    }

    // Create document
    const document = this.documentRepository.create({
      ...uploadDocumentDto,
      profile,
      profileId: profile.id,
      scanOk: false, // Default to unscanned
    });

    const savedDocument = await this.documentRepository.save(document);

    // If CV is uploaded, recalculate completion percentage
    if (uploadDocumentDto.type === 'CV') {
      const hasCv = await this.hasCvDocument(profile.id);
      const completionPercentage = this.calculateCompletionPercentage(
        profile,
        hasCv,
      );
      profile.completionPercentage = completionPercentage;
      profile.isComplete = completionPercentage > 80;
      await this.profileRepository.save(profile);
    }

    return this.mapDocumentToResponse(savedDocument);
  }

  /**
   * Get all documents for a user
   */
  async getDocuments(
    userId: string,
    limit: number = 20,
    offset: number = 0,
    type?: string,
  ): Promise<PaginatedResponseDto<DocumentResponseDto>> {
    const profile = await this.profileRepository.findOne({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found for this user');
    }

    // Build query
    let query = this.documentRepository
      .createQueryBuilder('doc')
      .where('doc.profileId = :profileId', { profileId: profile.id });

    // Filter by type if provided
    if (type) {
      const validTypes = ['CV', 'TRANSCRIPT', 'CERTIFICATE', 'CIN', 'OTHER'];
      if (!validTypes.includes(type)) {
        throw new BadRequestException(
          `Invalid document type. Allowed: ${validTypes.join(', ')}`,
        );
      }
      query = query.andWhere('doc.type = :type', { type });
    }

    // Apply pagination
    query = query
      .orderBy('doc.createdAt', 'DESC')
      .take(Math.min(limit, 100))
      .skip(offset);

    const [documents, total] = await query.getManyAndCount();

    return {
      data: documents.map((doc) => this.mapDocumentToResponse(doc)),
      total,
      limit,
      offset,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Delete a document (only owner can delete)
   */
  async deleteDocument(documentId: string, userId: string): Promise<void> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
      relations: ['profile'],
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Verify ownership
    if (document.profile.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this document',
      );
    }

    await this.documentRepository.remove(document);
  }

  /**
   * Check if profile has CV document
   */
  private async hasCvDocument(profileId: string): Promise<boolean> {
    const cvCount = await this.documentRepository.count({
      where: { profileId, type: 'CV' },
    });
    return cvCount > 0;
  }

  /**
   * Calculate completion percentage based on profile fields
   * CV uploaded: +40%
   * Phone: +20%
   * University: +15%
   * Level: +15%
   * Graduation Year: +10%
   */
  private calculateCompletionPercentage(
    profile: StudentProfile,
    hasCv?: boolean,
  ): number {
    let percentage = 0;

    // Add CV percentage if provided
    if (hasCv) {
      percentage += 40; // CV uploaded
    }

    if (profile.phone) {
      percentage += 20;
    }

    if (profile.university) {
      percentage += 15;
    }

    if (profile.level) {
      percentage += 15;
    }

    if (profile.graduationYear) {
      percentage += 10;
    }

    return Math.min(percentage, 100); // Cap at 100%
  }

  /**
   * Map profile entity to response DTO (exclude sensitive data)
   */
  private mapProfileToResponse(profile: StudentProfile): ProfileResponseDto {
    return {
      id: profile.id,
      phone: profile.phone,
      university: profile.university,
      level: profile.level,
      graduationYear: profile.graduationYear,
      skills: profile.skills || [],
      completionPercentage: profile.completionPercentage,
      isComplete: profile.isComplete,
      cinStatus: profile.cinStatus,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      // NEVER expose cinHash or isAiProcessed in response
    };
  }

  /**
   * Map document entity to response DTO (exclude sensitive data)
   */
  private mapDocumentToResponse(document: StudentDocument): DocumentResponseDto {
    return {
      id: document.id,
      type: document.type,
      fileName: document.fileName,
      fileUrl: document.fileUrl,
      fileType: document.fileType,
      size: document.size,
      scanOk: document.scanOk,
      createdAt: document.createdAt,
      // NEVER expose hash in response
    };
  }
}
