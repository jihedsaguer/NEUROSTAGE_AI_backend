import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudentProfile } from './entities/profiles.entity';
import { StudentDocument } from './entities/student-document.entity';
import { User } from '../users/entities/user.entity';
import {
  CreateProfileDto,
  UpdateProfileDto,
  ProfileResponseDto,
  DocumentResponseDto,
} from './dto';
import { PaginatedResponseDto } from 'src/common/dto';
import { StorageService } from './storage/storage.service';

const DOCUMENT_TYPE_RULES: Record<
  string,
  { allowedMimes: string[]; maxBytes: number }
> = {
  CV: {
    allowedMimes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    maxBytes: 10 * 1024 * 1024,
  },
  TRANSCRIPT: {
    allowedMimes: ['application/pdf', 'image/jpeg', 'image/png'],
    maxBytes: 10 * 1024 * 1024,
  },
  CERTIFICATE: {
    allowedMimes: ['application/pdf', 'image/jpeg', 'image/png'],
    maxBytes: 10 * 1024 * 1024,
  },
  CIN: {
    allowedMimes: ['image/jpeg', 'image/png'],
    maxBytes: 5 * 1024 * 1024,
  },
  OTHER: {
    allowedMimes: ['application/pdf', 'image/jpeg', 'image/png'],
    maxBytes: 10 * 1024 * 1024,
  },
};

@Injectable()
export class ProfilesService {
  private readonly logger = new Logger(ProfilesService.name);

  constructor(
    @InjectRepository(StudentProfile)
    private readonly profileRepository: Repository<StudentProfile>,
    @InjectRepository(StudentDocument)
    private readonly documentRepository: Repository<StudentDocument>,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Get or create profile for user
   * This is called when user first accesses profiles
   */
  async getOrCreateProfile(user: User): Promise<ProfileResponseDto> {
    const profile = await this.ensureProfileForUser(user.id);
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
    updateProfileDto: UpdateProfileDto | CreateProfileDto,
  ): Promise<ProfileResponseDto> {
    const profile = await this.ensureProfileForUser(userId);

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

    await this.refreshProfileCompletion(profile);

    // refreshProfileCompletion already saves the profile — return it directly
    // without an extra DB round-trip.
    return this.mapProfileToResponse(profile);
  }

  /**
   * Upload a document file for the current user
   */
  async uploadDocument(
    userId: string,
    type: string,
    file: Express.Multer.File,
  ): Promise<DocumentResponseDto> {
    // Synchronous size guard for CIN files to avoid processing large sensitive images
    if (type === 'CIN' && file && file.size > 5 * 1024 * 1024) {
      // Attempt to cleanup the uploaded file and reject immediately
      try {
        // cleanupUploadedFile is async; call deletePhysicalPath synchronously to remove temp file
        if (file?.path) {
          this.storageService.deletePhysicalPath(file.path);
        } else {
          // fallback to async cleanup
          void this.cleanupUploadedFile(file);
        }
      } catch (err) {
        // ignore
      }
      throw new BadRequestException('CIN image must be under 5MB');
    }
    const validTypes = Object.keys(DOCUMENT_TYPE_RULES);
    if (!validTypes.includes(type)) {
      await this.cleanupUploadedFile(file);
      throw new BadRequestException(
        `Invalid document type. Allowed: ${validTypes.join(', ')}`,
      );
    }

    const profile = await this.ensureProfileForUser(userId);

    try {
      this.validateDocumentFile(type, file);
    } catch (err) {
      await this.cleanupUploadedFile(file);
      throw err;
    }

    if (type === 'CV') {
      const existingCvs = await this.documentRepository.find({
        where: { profileId: profile.id, type: 'CV' },
      });

      if (existingCvs.length > 0) {
        existingCvs.forEach((doc) => this.storageService.deleteFile(doc.fileUrl));
        await this.documentRepository.remove(existingCvs);
      }
    }

    const hash = await this.storageService.computeFileHash(file.path);
    const metadata = this.storageService.getFileMetadata(userId, file, hash);

    const document = this.documentRepository.create({
      type,
      fileName: metadata.fileName,
      fileUrl: metadata.fileUrl,
      fileType: file.mimetype,
      size: metadata.size,
      hash: metadata.hash,
      profile,
      profileId: profile.id,
      scanOk: false,
    });

    const savedDocument = await this.documentRepository.save(document);

    if (type === 'CV') {
      await this.refreshProfileCompletion(profile);
      // Fire-and-forget: send CV to AI service for extraction + embedding
      Promise.resolve()
        .then(async () => {
          try {
            const AI_SERVICE_URL = process.env.AI_SERVICE_URL;
            const INTERNAL_SECRET = process.env.INTERNAL_SECRET;
            if (!AI_SERVICE_URL || !INTERNAL_SECRET) return;

            const fetchFn = (globalThis as any).fetch ?? (await import('node-fetch')).default;

            // 1) request extraction (service may fetch the file via fileUrl)
            const extractRes = await fetchFn(`${AI_SERVICE_URL.replace(/\/$/, '')}/extract`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Internal-Secret': INTERNAL_SECRET,
              },
              body: JSON.stringify({ filePath: file.path, userId, fileType: file.mimetype }),
            });

            if (!extractRes.ok) {
              this.logger.warn(`AI extract returned ${extractRes.status}`);
              return;
            }

            const extraction = await extractRes.json();
            const extractedText = extraction?.text ?? extraction?.extractedText ?? null;

            // 2) request embedding with extracted text and profile context
            await fetchFn(`${AI_SERVICE_URL.replace(/\/$/, '')}/embed/student`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Internal-Secret': INTERNAL_SECRET,
              },
              body: JSON.stringify({
                userId,
                extractedText: extractedText ?? '',
                skills: profile.skills ?? [],
                university: profile.university ?? '',
                specialization: '',
                level: profile.level ?? '',
              }),
            });
          } catch (err) {
            this.logger.warn(`AI CV processing (fire-and-forget) failed: ${(err as Error).message}`);
          }
        })
        .catch((err) => this.logger.warn(`AI CV processing scheduling failed: ${(err as Error).message}`));
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
    // Ensure profile exists for new users (create-if-missing)
    const profile = await this.ensureProfileForUser(userId);

    let query = this.documentRepository
      .createQueryBuilder('doc')
      .where('doc.profileId = :profileId', { profileId: profile.id });

    if (type) {
      const validTypes = Object.keys(DOCUMENT_TYPE_RULES);
      if (!validTypes.includes(type)) {
        throw new BadRequestException(
          `Invalid document type. Allowed: ${validTypes.join(', ')}`,
        );
      }
      query = query.andWhere('doc.type = :type', { type });
    }

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

    if (document.profile.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this document',
      );
    }

    const wasCv = document.type === 'CV';
    const profileId = document.profile.id;

    this.storageService.deleteFile(document.fileUrl);
    await this.documentRepository.remove(document);

    if (wasCv) {
      const profile = await this.profileRepository.findOne({
        where: { id: profileId },
      });
      if (profile) {
        await this.refreshProfileCompletion(profile);
      }
    }
  }

  private async ensureProfileForUser(userId: string): Promise<StudentProfile> {
    let profile = await this.profileRepository.findOne({
      where: { userId },
    });

    if (!profile) {
      profile = this.profileRepository.create({
        userId,
        skills: [],
        completionPercentage: 0,
        isComplete: false,
        cinStatus: 'PENDING',
        isAiProcessed: false,
      } as Partial<StudentProfile>);

      profile = await this.profileRepository.save(profile);
    }

    return profile;
  }

  private validateDocumentFile(
    type: string,
    file: Express.Multer.File,
  ): void {
    const rules = DOCUMENT_TYPE_RULES[type];
    if (!rules) {
      throw new BadRequestException(`Invalid document type: ${type}`);
    }

    if (!rules.allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type for document type ${type}. Allowed MIME types: ${rules.allowedMimes.join(', ')}`,
      );
    }

    if (file.size > rules.maxBytes) {
      const maxMb = rules.maxBytes / (1024 * 1024);
      throw new BadRequestException(
        `File exceeds maximum size of ${maxMb}MB for document type ${type}`,
      );
    }
  }

  private async cleanupUploadedFile(file: Express.Multer.File): Promise<void> {
    if (file?.path) {
      this.storageService.deletePhysicalPath(file.path);
    }
  }

  private async refreshProfileCompletion(
    profile: StudentProfile,
  ): Promise<void> {
    const hasCv = await this.hasCvDocument(profile.id);
    const completionPercentage = this.calculateCompletionPercentage(
      profile,
      hasCv,
    );
    profile.completionPercentage = completionPercentage;
    profile.isComplete = completionPercentage > 80;
    await this.profileRepository.save(profile);
  }

  private async hasCvDocument(profileId: string): Promise<boolean> {
    const cvCount = await this.documentRepository.count({
      where: { profileId, type: 'CV' },
    });
    return cvCount > 0;
  }

  private calculateCompletionPercentage(
    profile: StudentProfile,
    hasCv?: boolean,
  ): number {
    let percentage = 0;

    if (hasCv) {
      percentage += 40;
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

    return Math.min(percentage, 100);
  }

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
      cinLast3Digits: profile.cinLast3Digits ?? undefined,
      isAiProcessed: profile.isAiProcessed,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  private mapDocumentToResponse(
    document: StudentDocument,
  ): DocumentResponseDto {
    return {
      id: document.id,
      type: document.type,
      fileName: document.fileName,
      fileUrl: document.fileUrl,
      fileType: document.fileType,
      size: document.size,
      scanOk: document.scanOk,
      createdAt: document.createdAt,
    };
  }

  /**
   * Mark the profile as AI-processed. Used by internal FastAPI callbacks.
   */
  async markAiProcessed(userId: string): Promise<void> {
    const profile = await this.ensureProfileForUser(userId);
    profile.isAiProcessed = true;
    await this.profileRepository.save(profile);
  }

  /**
   * Request subject suggestions from AI service for a student. Returns
   * { suggestions: [], message?: string } on 404 or empty.
   */
  async getSubjectSuggestions(userId: string): Promise<any> {
    try {
      const AI_SERVICE_URL = process.env.AI_SERVICE_URL;
      const INTERNAL_SECRET = process.env.INTERNAL_SECRET;
      if (!AI_SERVICE_URL) {
        return { suggestions: [], message: 'AI service not configured' };
      }

      const fetchFn = (globalThis as any).fetch ?? (await import('node-fetch')).default;
      const res = await fetchFn(`${AI_SERVICE_URL.replace(/\/$/, '')}/suggest/${userId}`, {
        method: 'GET',
        headers: {
          'X-Internal-Secret': INTERNAL_SECRET ?? '',
        },
      });

      if (res.status === 404) {
        return { suggestions: [], message: 'Upload a CV to get subject suggestions' };
      }

      if (!res.ok) {
        this.logger.warn(`AI suggest returned ${res.status}`);
        return { suggestions: [], message: 'No suggestions available' };
      }

      const payload = await res.json();
      return { suggestions: payload.suggestions ?? [] };
    } catch (err) {
      this.logger.warn(`Failed to get AI suggestions: ${(err as Error).message}`);
      return { suggestions: [], message: 'AI suggestions unavailable' };
    }
  }
}
