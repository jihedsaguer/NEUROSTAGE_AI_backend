import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Candidature, CandidatureStatus } from './entities/candidature.entity';
import { CreateCandidatureDto, UpdateCandidatureDto } from './dto';
import { User } from '../users/entities/user.entity';
import { Subject } from '../subjects/entities/subject.entity';
import { SYSTEM_ROLES } from '../roles/constants/roles.constants';
import { StagesService } from '../stages/stages.service';

@Injectable()
export class CandidaturesService {
  constructor(
    @InjectRepository(Candidature)
    private readonly candidatureRepository: Repository<Candidature>,
    @InjectRepository(Subject)
    private readonly subjectRepository: Repository<Subject>,
    private readonly stagesService: StagesService,
  ) {}


   async mapToResponse(candidature: Candidature) {
    return {
      id: candidature.id,
        student: {
            id: candidature.student?.id,
            email: candidature.student?.email,
            firstName: candidature.student?.firstName,
            lastName: candidature.student?.lastName,
        },
        subject: {
            id: candidature.subject?.id,
            title: candidature.subject?.title,
            description: candidature.subject?.description,
            technologies: candidature.subject?.technologies,
            level: candidature.subject?.level,
            prerequisites: candidature.subject?.prerequisites,
            status: candidature.subject?.status,
        },
        status: candidature.status,
        motivation: candidature.motivation,
        createdAt: candidature.createdAt,
        scoreMatch: candidature.scoreMatch,
    };
}


async createCandidature(  dto: CreateCandidatureDto, user: User,) {
   
        if (!user.roles.some(role => role.name === SYSTEM_ROLES.STUDENT)) {
            console.log(user.roles);
            throw new ForbiddenException('Only students can create candidatures');  
        }
        const subject = await this.subjectRepository.findOne({ where: { id: dto.subjectId },
        relations: ['createdBy']
        });

        if (!subject || subject.status !== 'VALIDATED') {
            throw new NotFoundException('Subject not found');
        }

        const existing=await this.candidatureRepository.findOne({ where: 
            {
                 subject: { id: dto.subjectId },
             student: { id: user.id }
             } 
            });
        if (existing) {
            throw new BadRequestException('Candidature already exists');
        }
        
        const candidature = this.candidatureRepository.create({
            student: user,
            subject: subject,
            motivation: dto.motivation,
        });
        return this.mapToResponse(await this.candidatureRepository.save(candidature));
    }


    async getBySubjectId(subjectId: string,user: User) {
      
        const subject = await this.subjectRepository.findOne({ where: { id: subjectId },
        relations: ['createdBy']
        });
        if (!subject) {
            throw new NotFoundException('Subject not found');
        }

        const IsOwner = subject.createdBy?.id === user.id;
        const IsAdmin = user.roles.some(role => role.name === SYSTEM_ROLES.ADMIN_FORMATION || role.name === SYSTEM_ROLES.SUPER_ADMIN);
        if (!IsOwner && !IsAdmin) {
            throw new ForbiddenException('You do not have access to this resource');
        }
        return await this.candidatureRepository.find({ where: { subject: { id: subjectId } } });
    }
    async updateStatus(id: string, dto: UpdateCandidatureDto, user: User) {
    const candidature = await this.candidatureRepository.findOne({
      where: { id },
      relations: ['subject', 'subject.createdBy', 'subject.createdBy.roles'],
    });
    if (!candidature) {
      throw new NotFoundException('Candidature not found');
    }
    const IsOwner = candidature.subject?.createdBy?.id === user.id;
    const IsAdmin = user.roles.some(role => role.name === SYSTEM_ROLES.ADMIN_FORMATION || role.name === SYSTEM_ROLES.SUPER_ADMIN);
    if (!IsOwner && !IsAdmin) {
      throw new ForbiddenException('You do not have access to this resource');
    }

    const previousStatus = candidature.status;
    candidature.status = dto.status;
    const saved = await this.candidatureRepository.save(candidature);

    // Auto-create stage when candidature transitions to ACCEPTED.
    // If stage creation fails, roll back the status change so the system
    // never ends up with an ACCEPTED candidature that has no stage.
    if (
      dto.status === CandidatureStatus.ACCEPTED &&
      previousStatus !== CandidatureStatus.ACCEPTED
    ) {
      try {
        await this.stagesService.createStage({
          candidatureId: saved.id,
          encadrantProId: dto.encadrantProId,
          encadrantProEmail: dto.encadrantProEmail,
        });
      } catch (err) {
        // Roll back: revert candidature status to its previous value
        candidature.status = previousStatus;
        await this.candidatureRepository.save(candidature);

        const errorMsg =
          err instanceof Error ? `${err.name}: ${err.message}` : JSON.stringify(err);
        console.error(
          '[CandidaturesService] Auto stage creation failed — status rolled back:',
          errorMsg,
        );

        throw new BadRequestException(
          `Candidature accepted but stage creation failed: ${
            err instanceof Error ? err.message : 'unknown error'
          }. Status has been reverted.`,
        );
      }
    }

    return this.mapToResponse(saved);
  }

async FindMyCandidatures(user: User) {
    const IsStudent = user.roles.some(role => role.name === SYSTEM_ROLES.STUDENT);
    if (!IsStudent) {
      throw new ForbiddenException('Only students can view their candidatures');
    }

    return await this.candidatureRepository.find({ 
      where: { student: { id: user.id } },
      relations: ['student', 'subject'],
    });
}

  /**
   * Cancel a candidature - allows students to cancel their own, admins to cancel any
   * Cascade delete will handle removal of related stages
   */
  async cancelCandidature(candidatureId: string, user: User): Promise<void> {
    const candidature = await this.candidatureRepository.findOne({
      where: { id: candidatureId },
      relations: [
        'student',
        'subject',
        'subject.createdBy',
        'subject.createdBy.roles',
        'stages',
      ],
    });

    if (!candidature) {
      throw new NotFoundException('Candidature not found');
    }

    const IsStudent = user.roles.some((role) => role.name === SYSTEM_ROLES.STUDENT);
    const IsAdmin = user.roles.some(
      (role) =>
        role.name === SYSTEM_ROLES.ADMIN_FORMATION ||
        role.name === SYSTEM_ROLES.SUPER_ADMIN,
    );
    const IsOwner = candidature.student?.id === user.id;

    // Only the student (owner) or admin can cancel a candidature
    if (IsStudent && !IsOwner) {
      throw new ForbiddenException('Students can only cancel their own candidatures');
    }

    if (!IsStudent && !IsAdmin) {
      throw new ForbiddenException('Only students and admins can cancel candidatures');
    }

    // Block cancellation only if there are stages that are still active/pending.
    // Completed or cancelled stages do not block cancellation.
    const activeStages = (candidature.stages ?? []).filter(
      (s: any) => s.status === 'ACTIVE' || s.status === 'PENDING_ACAD',
    );
    if (activeStages.length > 0) {
      throw new BadRequestException(
        'Cannot cancel candidature with active stages. Cancel the stage first.',
      );
    }

    // Cascade delete will handle stages removal
    await this.candidatureRepository.remove(candidature);
  }

  /** Returns ALL candidatures regardless of status (admin use). */
  async getAllCandidatures() {
    return await this.candidatureRepository.find({
      relations: ['student', 'subject'],
      order: { createdAt: 'DESC' },
    });
  }

  /** Returns only ACCEPTED candidatures — used for stage creation flows. */
  async getAcceptedCandidatures() {
    return await this.candidatureRepository.find({
      relations: ['student', 'subject'],
      where: { status: CandidatureStatus.ACCEPTED },
      order: { createdAt: 'DESC' },
    });
  }
  
}