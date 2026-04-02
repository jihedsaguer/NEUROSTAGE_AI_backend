import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject, SubjectStatus } from './entities/subject.entity';
import { CreateSubjectDto, UpdateSubjectDto, ValidateSubjectDto,SubjectResponseDto } from './dto';
import { User } from '../users/entities/user.entity';
import { SYSTEM_ROLES } from '../roles/constants/roles.constants';

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
    const userRole = this.getUserRole(user);

    let status = SubjectStatus.DRAFT;
    if (userRole === SYSTEM_ROLES.STUDENT) {
      status = SubjectStatus.PENDING;
    } else if (userRole === SYSTEM_ROLES.ENCADRANT_PRO) {
      status = SubjectStatus.DRAFT;
    }

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
  throw new Error('Subject not found after creation');
}
  return this.mapToResponse(fullSubject);
}

  async getAllSubjects(user: User): Promise<Subject[]> {
    const userRole = this.getUserRole(user);

    if (userRole === SYSTEM_ROLES.STUDENT) {
      return await this.subjectRepository.find({
        where: { status: SubjectStatus.VALIDATED },
        order: { createdAt: 'DESC' },
      });
    }

    if (
      userRole === SYSTEM_ROLES.SUPER_ADMIN ||
      userRole === SYSTEM_ROLES.ADMIN_FORMATION
    ) {
      return await this.subjectRepository.find({
        order: { createdAt: 'DESC' },
      });
    }

    return await this.subjectRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getSubjectById(id: string, user: User): Promise<Subject> {
    const subject = await this.subjectRepository.findOne({
      where: { id },
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

  async getMySubjects(user: User): Promise<Subject[]> {
    return await this.subjectRepository.find({
      where: { createdBy: { id: user.id } },
      order: { createdAt: 'DESC' },
    });
  }

  async getPendingSubjects(): Promise<Subject[]> {
    return await this.subjectRepository.find({
      where: { status: SubjectStatus.PENDING },
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
    });

    if (!subject) {
      throw new NotFoundException(`Subject with ID ${id} not found`);
    }

    const userRole = this.getUserRole(user);
    const isOwner = subject.createdBy.id === user.id;
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
}
