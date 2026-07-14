import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  NotAcceptableException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Subject, SubjectStatus } from './entities/subject.entity';
import { GenerationIA } from '../ai/entities/generation-ia.entity';
import { CreateSubjectDto, UpdateSubjectDto, ValidateSubjectDto, SubjectResponseDto, QuerySubjectsFilterDto, SortField, SortOrder } from './dto';
import { User } from '../users/entities/user.entity';
import { SYSTEM_ROLES } from '../roles/constants/roles.constants';
import { PaginatedResponseDto } from '../../common/dto';

@Injectable()
export class SubjectsService {
  private readonly logger = new Logger(SubjectsService.name);
  constructor(
    @InjectRepository(Subject)
    private readonly subjectRepository: Repository<Subject>,
    @InjectRepository(GenerationIA)
    private readonly generationRepository: Repository<GenerationIA>,
  ) {}

  /**
   * Generate subject drafts for given students by asking the AI service.
   * Only ENCADRANT_PRO users should call this via controller guard.
   */
  async generateSubjectDraft(
    studentIds: string[],
    encadreurId: string,
    context?: string,
  ) {
    const AI_SERVICE_URL = process.env.AI_SERVICE_URL;
    const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

    if (!AI_SERVICE_URL || !INTERNAL_SECRET) {
      return { error: 'AI service not configured', drafts: [] };
    }

    const payload = { studentIds, encadreurId, context };

    try {
      const fetchFn = (globalThis as any).fetch ?? (await import('node-fetch')).default;

      const resp = await fetchFn(`${AI_SERVICE_URL.replace(/\/$/, '')}/generate/subject-from-cv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': INTERNAL_SECRET,
        },
        body: JSON.stringify(payload),
      });

      if (resp.status === 404) {
        const body = await resp.json().catch(() => ({}));
        const detail = (body as any)?.detail ?? 'One or more students have not uploaded a CV yet';
        return { error: detail, drafts: [] };
      }
      if (!resp.ok) {
        this.logger.warn(`AI generation returned ${resp.status}`);
        return { error: 'AI generation failed — please try again later', drafts: [] };
      }

      const result = await resp.json();

      // Strip rawPromptUsed before returning to frontend and persist it for audit
      const { rawPromptUsed, ...safeResult } = result as Record<string, any>;

      try {
        if (this.generationRepository) {
          await this.generationRepository.save({
            type: 'SUBJECT_DRAFT',
            prompt: rawPromptUsed ?? JSON.stringify(payload),
            response: safeResult,
            validePar: encadreurId,
          } as any);
        }
      } catch (e) {
        this.logger.warn(`Failed to persist GenerationIA: ${(e as Error).message}`);
      }

      // Auto-create the subject as DRAFT so admin_formation can validate it
      let createdSubject: Subject | null = null;
      try {
        const subject = this.subjectRepository.create({
          title: safeResult.titre ?? safeResult.title ?? 'AI Generated Subject',
          description: safeResult.description ?? '',
          technologies: safeResult.techno ?? safeResult.technologies ?? [],
          prerequisites: safeResult.prerequis ?? safeResult.prerequisites ?? '',
          level: safeResult.niveau ?? safeResult.level ?? '',
          status: SubjectStatus.DRAFT,
          generatedByAi: true,
          aiGenerationSource: 'OLLAMA',
          createdBy: { id: encadreurId } as User,
        });
        createdSubject = await this.subjectRepository.save(subject);
        this.logger.log(
          `AI-generated subject created: ${createdSubject.id} by encadreur ${encadreurId}`,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to auto-create subject from AI draft: ${(err as Error).message}`,
        );
      }

      return {
        titre: safeResult.titre ?? safeResult.title ?? null,
        description: safeResult.description ?? null,
        techno: safeResult.techno ?? safeResult.technologies ?? [],
        prerequis: safeResult.prerequis ?? safeResult.prerequisites ?? '',
        niveau: safeResult.niveau ?? safeResult.level ?? null,
        subjectId: createdSubject?.id ?? null,
        status: 'DRAFT',
      };
    } catch (err) {
      this.logger.warn(`generateSubjectDraft failed: ${(err as Error).message}`);
      return { error: 'AI service unreachable — please try again later', drafts: [] };
    }
  }


  private mapToResponse(subject: Subject) {
  return {
    id: subject.id,
    title: subject.title,
    description: subject.description,
    technologies: subject.technologies,
    level: subject.level,
    prerequisites: subject.prerequisites,
    status: subject.status,
    createdBy: {
  id: subject.createdBy?.id ?? 'unknown',
  firstName: subject.createdBy?.firstName ?? 'unknown',
  lastName: subject.createdBy?.lastName ?? 'unknown',
},
    createdAt: subject.createdAt,
    updatedAt: subject.updatedAt,
  };
}

  async createSubject(
    createSubjectDto: CreateSubjectDto,
    user: User,
  ): Promise<SubjectResponseDto> {
    // Verify user is active
    if (!user || !user.isActive) {
      throw new ForbiddenException('User account is inactive');
    }

    const userRole = this.getUserRole(user);

    // Determine status based on role (trust-based)
    let status = SubjectStatus.DRAFT; // default
    
    if (
      userRole === SYSTEM_ROLES.SUPER_ADMIN ||
      userRole === SYSTEM_ROLES.ADMIN_FORMATION
    ) {
      // Auto-validate admin subjects (trust-based access)
      status = SubjectStatus.VALIDATED;
    } else if (userRole === SYSTEM_ROLES.STUDENT) {
      // Student subjects require admin approval
      status = SubjectStatus.PENDING;
    }
    // ENCADRANT_PRO subjects stay DRAFT (require validation)

    const subject = this.subjectRepository.create({
      ...createSubjectDto,
      status,
      createdBy: user,
    });

    const savedSubject = await this.subjectRepository.save(subject);

    const fullSubject = await this.subjectRepository.findOne({
      where: { id: savedSubject.id },
      relations: ['createdBy'],
    });

    if (!fullSubject) {
      throw new NotFoundException('Subject not found after creation');
    }

    return this.mapToResponse(fullSubject);
  }

  async getAllSubjects(
    user: User,
    filter: QuerySubjectsFilterDto = new QuerySubjectsFilterDto(),
  ): Promise<PaginatedResponseDto<SubjectResponseDto>> {
    const userRole = this.getUserRole(user);
    const limit = Math.min(filter.limit || 20, 100); // Cap at 100
    const offset = filter.offset || 0;

    // Build query
    let query = this.subjectRepository
      .createQueryBuilder('subject')
      .leftJoinAndSelect('subject.createdBy', 'createdBy');

    // Apply role-based visibility
    query = this.applyRoleBasedVisibility(query, userRole);

    // Apply search filter
    if (filter.search && filter.search.trim()) {
      query.andWhere(
        '(subject.title ILIKE :search OR subject.description ILIKE :search)',
        { search: `%${filter.search}%` },
      );
    }

    // Apply technologies filter
    if (filter.technologies && filter.technologies.length > 0) {
      query.andWhere('subject.technologies && :technologies', {
        technologies: filter.technologies,
      });
    }

    // Apply level filter
    if (filter.level) {
      query.andWhere('subject.level = :level', { level: filter.level });
    }

    // Apply status filter (only allow admins to filter by status)
    if (
      filter.status &&
      filter.status.length > 0 &&
      (userRole === SYSTEM_ROLES.SUPER_ADMIN ||
        userRole === SYSTEM_ROLES.ADMIN_FORMATION)
    ) {
      query.andWhere('subject.status IN (:...statuses)', {
        statuses: filter.status,
      });
    }

    // Apply sorting
    const sortOrder = filter.sortOrder === SortOrder.ASC ? 'ASC' : 'DESC';
    if (filter.sortBy === SortField.TITLE) {
      query.orderBy('subject.title', sortOrder as any);
    } else {
      query.orderBy('subject.createdAt', sortOrder as any);
    }

    // Get total count before pagination
    const total = await query.getCount();

    // Apply pagination
    query.skip(offset).take(limit);

    // Execute query
    const subjects = await query.getMany();
    const data = subjects.map((s) => this.mapToResponse(s));

    return new PaginatedResponseDto(data, total, limit, offset);
  }

  async getSubjectById(id: string, user: User): Promise<Subject> {
    const subject = await this.subjectRepository.findOne({
      where: { id },
      relations: ['createdBy'],
    });

    if (!subject) {
      throw new NotFoundException(`Subject with ID ${id} not found`);
    }

    const userRole = this.getUserRole(user);

    if (
      userRole === SYSTEM_ROLES.STUDENT &&
      subject.status !== SubjectStatus.VALIDATED
    ) {
      throw new ForbiddenException(
        'Students can only view validated subjects',
      );
    }

    return subject;
  }

  async getMySubjects(
    user: User,
    filter: QuerySubjectsFilterDto = new QuerySubjectsFilterDto(),
  ): Promise<PaginatedResponseDto<SubjectResponseDto>> {
    const limit = Math.min(filter.limit || 20, 100);
    const offset = filter.offset || 0;

    let query = this.subjectRepository
      .createQueryBuilder('subject')
      .leftJoinAndSelect('subject.createdBy', 'createdBy')
      .where('subject.createdBy.id = :userId', { userId: user.id });

    // Apply search filter
    if (filter.search && filter.search.trim()) {
      query.andWhere(
        '(subject.title ILIKE :search OR subject.description ILIKE :search)',
        { search: `%${filter.search}%` },
      );
    }

    // Apply technologies filter
    if (filter.technologies && filter.technologies.length > 0) {
      query.andWhere('subject.technologies && :technologies', {
        technologies: filter.technologies,
      });
    }

    // Apply level filter
    if (filter.level) {
      query.andWhere('subject.level = :level', { level: filter.level });
    }

    // Apply status filter
    if (filter.status && filter.status.length > 0) {
      query.andWhere('subject.status IN (:...statuses)', {
        statuses: filter.status,
      });
    }

    // Apply sorting
    const sortOrder = filter.sortOrder === SortOrder.ASC ? 'ASC' : 'DESC';
    if (filter.sortBy === SortField.TITLE) {
      query.orderBy('subject.title', sortOrder as any);
    } else {
      query.orderBy('subject.createdAt', sortOrder as any);
    }

    // Get total count
    const total = await query.getCount();

    // Apply pagination
    query.skip(offset).take(limit);

    // Execute query
    const subjects = await query.getMany();
    const data = subjects.map((s) => this.mapToResponse(s));

    return new PaginatedResponseDto(data, total, limit, offset);
  }

  async getPendingSubjects(): Promise<Subject[]> {
    return await this.subjectRepository.find({
      where: { status: SubjectStatus.PENDING },
      relations: ['createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateSubject(
    id: string,
    updateSubjectDto: UpdateSubjectDto,
    user: User,
  ): Promise<Subject> {
    const subject = await this.subjectRepository.findOne({
      where: { id },
      relations: ['createdBy'],
    });

    if (!subject) {
      throw new NotFoundException(`Subject with ID ${id} not found`);
    }

    const userRole = this.getUserRole(user);
    const isOwner = subject.createdBy?.id === user.id;
    const isAdmin =
      userRole === SYSTEM_ROLES.SUPER_ADMIN ||
      userRole === SYSTEM_ROLES.ADMIN_FORMATION;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'You can only update your own subjects',
      );
    }

    Object.assign(subject, updateSubjectDto);
    return await this.subjectRepository.save(subject);
  }

  async deleteSubject(id: string, user: User): Promise<void> {
    const subject = await this.subjectRepository.findOne({
      where: { id },
      relations: ['createdBy'],
    });

    if (!subject) {
      throw new NotFoundException(`Subject with ID ${id} not found`);
    }

    const userRole = this.getUserRole(user);
    const isOwner = subject.createdBy?.id === user.id;
    const isAdmin =
      userRole === SYSTEM_ROLES.SUPER_ADMIN ||
      userRole === SYSTEM_ROLES.ADMIN_FORMATION;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'You can only delete your own subjects',
      );
    }

    await this.subjectRepository.remove(subject);
  }

  async validateSubject(
    id: string,
    validateSubjectDto: ValidateSubjectDto,
    user: User,
  ): Promise<Subject> {
    const subject = await this.subjectRepository.findOne({
      where: { id },
      relations: ['createdBy'],
    });

    if (!subject) {
      throw new NotFoundException(`Subject with ID ${id} not found`);
    }

    const allowedStatuses = [
      SubjectStatus.PENDING,
      SubjectStatus.VALIDATED,
      SubjectStatus.REJECTED,
    ];

    if (!allowedStatuses.includes(validateSubjectDto.status)) {
      throw new BadRequestException(
        'Status must be PENDING, VALIDATED, or REJECTED',
      );
    }

    // Encadreur_pro can only submit for review (DRAFT → PENDING)
    // Admins can validate or reject (PENDING → VALIDATED/REJECTED)
    const userRole = this.getUserRole(user);
    if (
      userRole === SYSTEM_ROLES.ENCADRANT_PRO &&
      validateSubjectDto.status !== SubjectStatus.PENDING
    ) {
      throw new ForbiddenException(
        'Encadreur can only submit subjects for review',
      );
    }

    subject.status = validateSubjectDto.status;
    const saved = await this.subjectRepository.save(subject);

    // Fire-and-forget: index subject embedding when validated
    if (saved.status === SubjectStatus.VALIDATED) {
      Promise.resolve()
        .then(async () => {
          try {
            const AI_SERVICE_URL = process.env.AI_SERVICE_URL;
            const INTERNAL_SECRET = process.env.INTERNAL_SECRET;
            if (!AI_SERVICE_URL || !INTERNAL_SECRET) return;

            const fetchFn = (globalThis as any).fetch ?? (await import('node-fetch')).default;

            await fetchFn(`${AI_SERVICE_URL.replace(/\/$/, '')}/embed/subject`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Internal-Secret': INTERNAL_SECRET,
              },
              body: JSON.stringify({
                subjectId: saved.id,
                titre: saved.title,
                description: saved.description,
                techno: saved.technologies ?? [],
                prerequis: saved.prerequisites ?? '',
                niveau: saved.level ?? '',
              }),
            });
          } catch (err) {
            this.logger.warn(`Subject embedding failed: ${(err as Error).message}`);
          }
        })
        .catch((err) => this.logger.warn(`Subject embedding scheduling failed: ${(err as Error).message}`));
    }

    return saved;
  }

  /**
   * Return all validated subjects (used by startup indexing)
   */
  async getValidatedSubjects(): Promise<Subject[]> {
return await this.subjectRepository.find({
  where: { status: SubjectStatus.VALIDATED },
  relations: ['createdBy'],
});  }

  private getUserRole(user: User): string | undefined {
    return user?.roles && user.roles.length > 0
      ? user.roles[0].name
      : undefined;
  }

  private applyRoleBasedVisibility(query: any, userRole: string | undefined) {
    // Students and academic tutors see only VALIDATED subjects
    if (
      userRole === SYSTEM_ROLES.STUDENT ||
      userRole === SYSTEM_ROLES.ENCADRANT_ACADEMIQUE
    ) {
      query.andWhere('subject.status = :status', {
        status: SubjectStatus.VALIDATED,
      });
    }
    // Admins and ENCADRANT_PRO see all subjects (no additional filtering)
    return query;
  }
}
