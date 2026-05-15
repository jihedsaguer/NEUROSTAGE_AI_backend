import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  NotAcceptableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Subject, SubjectStatus } from './entities/subject.entity';
import { CreateSubjectDto, UpdateSubjectDto, ValidateSubjectDto, SubjectResponseDto, QuerySubjectsFilterDto, SortField, SortOrder } from './dto';
import { User } from '../users/entities/user.entity';
import { SYSTEM_ROLES } from '../roles/constants/roles.constants';
import { PaginatedResponseDto } from '../../common/dto';

@Injectable()
export class SubjectsService {
  constructor(
    @InjectRepository(Subject)
    private readonly subjectRepository: Repository<Subject>,
  ) {}


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
      id: subject.createdBy.id,
      firstName: subject.createdBy.firstName,
      lastName: subject.createdBy.lastName,
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
  ): Promise<Subject> {
    const subject = await this.subjectRepository.findOne({
      where: { id },
      relations: ['createdBy'],
    });

    if (!subject) {
      throw new NotFoundException(`Subject with ID ${id} not found`);
    }

    if (
      validateSubjectDto.status !== SubjectStatus.VALIDATED &&
      validateSubjectDto.status !== SubjectStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Status must be either VALIDATED or REJECTED',
      );
    }

    subject.status = validateSubjectDto.status;
    return await this.subjectRepository.save(subject);
  }

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
