import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Stage, StageStatus } from './entities/stage.entity';
import { Candidature, CandidatureStatus } from '../candidatures/entities/candidature.entity';
import { User } from '../users/entities/user.entity';
import { Subject } from '../subjects/entities/subject.entity';
import { SYSTEM_ROLES } from '../roles/constants/roles.constants';
import { ChatService } from '../chat/chat.service';
import {
  CreateStageDto,
  UpdateStageDto,
  AssignAcadDto,
  AssignProDto,
  StageResponseDto,
} from './dto';

@Injectable()
export class StagesService {
  private readonly logger = new Logger(StagesService.name);

  constructor(
    @InjectRepository(Stage)
    private readonly stageRepository: Repository<Stage>,
    @InjectRepository(Candidature)
    private readonly candidatureRepository: Repository<Candidature>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Subject)
    private readonly subjectRepository: Repository<Subject>,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
  ) {}

  // ─── Create stage from accepted candidature ──────────────────────────────────
  // Two methods supported:
  // 1. OLD: Admin provides candidatureId (knows the ID)
  // 2. NEW: Admin provides studentEmail + subjectId/subjectTitle + optional encadrantProEmail
  // Admins can explicitly assign encadrant pro, otherwise falls back to subject creator.
  // Subject creator may be encadrant_pro, admin_formation, or super_admin for auto-creation.

  async createStage(dto: CreateStageDto): Promise<StageResponseDto> {
    // For auto-creation (only candidatureId provided, no encadrant info)
    if (dto.candidatureId && !dto.encadrantProId && !dto.encadrantProEmail && !dto.studentEmail) {
      return this.autoCreateStageFromCandidature(dto.candidatureId, dto);
    }

    let candidature: Candidature | null = null;

    // Method 1: Find by candidatureId (backward compatible)
    if (dto.candidatureId) {
      candidature = await this.candidatureRepository.findOne({
        where: { id: dto.candidatureId },
        relations: ['student', 'subject', 'subject.createdBy', 'subject.createdBy.roles'],
      });

      if (!candidature) {
        throw new NotFoundException('Candidature not found');
      }
    }
    // Method 2: Find by studentEmail + subjectId or subjectTitle
    else if (dto.studentEmail && (dto.subjectId || dto.subjectTitle)) {
      const student = await this.userRepository.findOne({
        where: { email: dto.studentEmail },
      });

      if (!student) {
        throw new NotFoundException(`Student with email ${dto.studentEmail} not found`);
      }

      let subject;
      if (dto.subjectId) {
        subject = await this.findSubjectById(dto.subjectId);
      } else if (dto.subjectTitle) {
        subject = await this.findSubjectByTitle(dto.subjectTitle);
      } else {
        throw new BadRequestException('Either subjectId or subjectTitle must be provided');
      }

      candidature = await this.candidatureRepository.findOne({
        where: {
          student: { id: student.id },
          subject: { id: subject.id },
        },
        relations: ['student', 'subject', 'subject.createdBy', 'subject.createdBy.roles'],
      });

      if (!candidature) {
        throw new NotFoundException(
          `No candidature found for student ${dto.studentEmail} on subject ${dto.subjectTitle || dto.subjectId}`,
        );
      }
    } else {
      throw new BadRequestException(
        'Provide either candidatureId OR (studentEmail + subjectId/subjectTitle)',
      );
    }

    if (candidature.status !== CandidatureStatus.ACCEPTED) {
      throw new BadRequestException(
        'Only accepted candidatures can be promoted to a stage',
      );
    }

    const existing = await this.stageRepository.findOne({
      where: { candidatureId: candidature.id },
    });
    if (existing) {
      throw new ConflictException('A stage already exists for this candidature');
    }

    // Resolve encadrant pro: UUID -> email -> subject creator
    let encadrantPro: User;
    if (dto.encadrantProId) {
      encadrantPro = await this.resolveEncadrantPro(dto.encadrantProId);
    } else if (dto.encadrantProEmail) {
      encadrantPro = await this.resolveEncadrantProByEmail(dto.encadrantProEmail);
    } else {
      const subjectCreator = candidature.subject.createdBy;
      if (!this.isValidAutoStageSupervisor(subjectCreator)) {
        throw new BadRequestException(
          'Subject creator must be encadrant_pro, admin_formation, or super_admin. Please explicitly provide encadrantProId or encadrantProEmail.',
        );
      }
      encadrantPro = subjectCreator;
    }

    // Resolve academic supervisor: UUID -> email
    let encadrantAcad: User | null = null;
    if (dto.encadrantAcadId) {
      encadrantAcad = await this.resolveEncadrantAcad(dto.encadrantAcadId);
    } else if (dto.encadrantAcadEmail) {
      encadrantAcad = await this.resolveEncadrantAcadByEmail(dto.encadrantAcadEmail);
    }

    const stage = this.stageRepository.create({
      candidature,
      candidatureId: candidature.id,
      subject: candidature.subject,
      subjectId: candidature.subject.id,
      student: candidature.student,
      studentId: candidature.student.id,
      encadrantPro,
      encadrantProId: encadrantPro.id,
      encadrantAcad,
      encadrantAcadId: encadrantAcad?.id ?? null,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      adminNotes: dto.adminNotes ?? null,
      status: encadrantAcad ? StageStatus.ACTIVE : StageStatus.PENDING_ACAD,
    });

    const saved = await this.stageRepository.save(stage);

    // Auto-create the chat room for this stage (non-blocking — failure must not
    // roll back the stage creation itself).
    const fullSaved = await this.loadFullStage(saved.id);
    this.chatService.createRoomForStage(fullSaved).catch((err) =>
      this.logger.error(`Failed to create chat room for stage ${saved.id}`, err),
    );

    return this.mapToResponse(fullSaved);
  }

  /**
   * Auto-create stage from candidature when candidature status changes to ACCEPTED
   * This is lenient - subject creator may be encadrant_pro, admin_formation, or super_admin
   * Sets stage to PENDING_ACAD status (waiting for academic supervisor)
   */
  private async autoCreateStageFromCandidature(
    candidatureId: string,
    dto: CreateStageDto,
  ): Promise<StageResponseDto> {
    const candidature = await this.candidatureRepository.findOne({
      where: { id: candidatureId },
      relations: ['student', 'subject', 'subject.createdBy', 'subject.createdBy.roles'],
    });

    if (!candidature) {
      throw new NotFoundException('Candidature not found');
    }

    if (candidature.status !== CandidatureStatus.ACCEPTED) {
      throw new BadRequestException(
        'Only accepted candidatures can be promoted to a stage',
      );
    }

    const existing = await this.stageRepository.findOne({
      where: { candidatureId: candidature.id },
    });
    if (existing) {
      throw new ConflictException('A stage already exists for this candidature');
    }

    // For auto-creation, use subject creator as encadrant pro (must have the role)
    const subjectCreator = candidature.subject.createdBy;
    if (!this.isValidAutoStageSupervisor(subjectCreator)) {
      throw new BadRequestException(
        `Subject creator ${subjectCreator.email} is not authorized to auto-create a stage. Must be encadrant_pro, admin_formation, or super_admin.`,
      );
    }

    const stage = this.stageRepository.create({
      candidature,
      candidatureId: candidature.id,
      subject: candidature.subject,
      subjectId: candidature.subject.id,
      student: candidature.student,
      studentId: candidature.student.id,
      encadrantPro: subjectCreator,
      encadrantProId: subjectCreator.id,
      encadrantAcad: null,
      encadrantAcadId: null,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      adminNotes: dto.adminNotes ?? null,
      status: StageStatus.PENDING_ACAD, // Auto-created stages always start PENDING_ACAD
    });

    const saved = await this.stageRepository.save(stage);
    this.logger.log(
      `[StagesService] Auto-created stage ${saved.id} for candidature ${candidatureId}`,
    );

    const fullSaved = await this.loadFullStage(saved.id);

    // Auto-create the chat room (non-blocking)
    this.chatService.createRoomForStage(fullSaved).catch((err) =>
      this.logger.error(`Failed to create chat room for stage ${saved.id}`, err),
    );

    return this.mapToResponse(fullSaved);
  }

  // ─── Assign / reassign encadrant pro (admin only) ────────────────────────────

  async assignEncadrantPro(stageId: string, dto: AssignProDto): Promise<StageResponseDto> {
    const stage = await this.loadFullStage(stageId);

    if (stage.status === StageStatus.COMPLETED || stage.status === StageStatus.CANCELLED) {
      throw new BadRequestException('Cannot modify a completed or cancelled stage');
    }

    const encadrantPro = await this.resolveEncadrantPro(dto.encadrantProId);
    stage.encadrantPro = encadrantPro;
    stage.encadrantProId = encadrantPro.id;

    const saved = await this.stageRepository.save(stage);
    return this.mapToResponse(await this.loadFullStage(saved.id));
  }

  // ─── Assign / reassign encadrant acad (admin only) ───────────────────────────

  async assignEncadrantAcad(stageId: string, dto: AssignAcadDto): Promise<StageResponseDto> {
    const stage = await this.loadFullStage(stageId);

    if (stage.status === StageStatus.COMPLETED || stage.status === StageStatus.CANCELLED) {
      throw new BadRequestException('Cannot modify a completed or cancelled stage');
    }

    const encadrantAcad = await this.resolveEncadrantAcad(dto.encadrantAcadId);
    stage.encadrantAcad = encadrantAcad;
    stage.encadrantAcadId = encadrantAcad.id;

    if (stage.status === StageStatus.PENDING_ACAD) {
      stage.status = StageStatus.ACTIVE;
    }

    const saved = await this.stageRepository.save(stage);

    // Add the newly assigned academic supervisor to the stage chat room (non-blocking)
    this.chatService.addEncadrantAcadToStageRoom(stageId, encadrantAcad.id).catch((err) =>
      this.logger.error(
        `Failed to add encadrantAcad ${encadrantAcad.id} to chat room for stage ${stageId}`,
        err,
      ),
    );

    return this.mapToResponse(await this.loadFullStage(saved.id));
  }

  // ─── Update stage metadata (admin only) ─────────────────────────────────────

  async updateStage(stageId: string, dto: UpdateStageDto): Promise<StageResponseDto> {
    const stage = await this.loadFullStage(stageId);

    if (dto.status !== undefined) stage.status = dto.status;
    if (dto.startDate !== undefined) stage.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) stage.endDate = new Date(dto.endDate);
    if (dto.adminNotes !== undefined) stage.adminNotes = dto.adminNotes;

    const saved = await this.stageRepository.save(stage);
    return this.mapToResponse(await this.loadFullStage(saved.id));
  }

  // ─── Complete stage (admin only) ─────────────────────────────────────────────

  async completeStage(stageId: string): Promise<StageResponseDto> {
    const stage = await this.loadFullStage(stageId);

    if (stage.status === StageStatus.CANCELLED) {
      throw new BadRequestException('Cannot complete a cancelled stage');
    }
    if (stage.status === StageStatus.COMPLETED) {
      throw new BadRequestException('Stage is already completed');
    }
    if (stage.status === StageStatus.PENDING_ACAD) {
      throw new BadRequestException(
        'Cannot complete a stage that is still pending academic supervisor assignment',
      );
    }

    stage.status = StageStatus.COMPLETED;
    const saved = await this.stageRepository.save(stage);
    return this.mapToResponse(await this.loadFullStage(saved.id));
  }

  // ─── Cancel stage (admin only) ───────────────────────────────────────────────

  async cancelStage(stageId: string): Promise<StageResponseDto> {
    const stage = await this.loadFullStage(stageId);

    if (stage.status === StageStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed stage');
    }
    if (stage.status === StageStatus.CANCELLED) {
      throw new BadRequestException('Stage is already cancelled');
    }

    stage.status = StageStatus.CANCELLED;
    const saved = await this.stageRepository.save(stage);
    return this.mapToResponse(await this.loadFullStage(saved.id));
  }

  // ─── Get all stages (admin) ──────────────────────────────────────────────────

  async getAllStages(): Promise<StageResponseDto[]> {
    const stages = await this.stageRepository.find({
      relations: ['subject', 'student', 'encadrantPro', 'encadrantAcad'],
      order: { createdAt: 'DESC' },
    });
    return stages.map((s) => this.mapToResponse(s));
  }

  // ─── Get stage by ID (role-scoped visibility) ────────────────────────────────

  async getStageById(stageId: string, user: User): Promise<StageResponseDto> {
    const stage = await this.loadFullStage(stageId);

    if (this.hasAnyRole(user, [SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ADMIN_FORMATION])) {
      return this.mapToResponse(stage);
    }

    const canAccessAsStudent = this.hasRole(user, SYSTEM_ROLES.STUDENT) && stage.studentId === user.id;
    const canAccessAsPro = this.hasRole(user, SYSTEM_ROLES.ENCADRANT_PRO) && stage.encadrantProId === user.id;
    const canAccessAsAcad = this.hasRole(user, SYSTEM_ROLES.ENCADRANT_ACADEMIQUE) && stage.encadrantAcadId === user.id;

    if (canAccessAsStudent || canAccessAsPro || canAccessAsAcad) {
      return this.mapToResponse(stage);
    }

    throw new ForbiddenException('Access denied');
  }

  // ─── Role-scoped list endpoints ──────────────────────────────────────────────

  async getMyStage(user: User): Promise<StageResponseDto> {
    // A student has at most one active stage at a time (enforced by UNIQUE candidatureId).
    const stage = await this.stageRepository.findOne({
      where: { studentId: user.id },
      relations: ['subject', 'student', 'encadrantPro', 'encadrantAcad'],
    });
    if (!stage) throw new NotFoundException('No stage found for this student');
    return this.mapToResponse(stage);
  }

  async getMyStagesAsEncadrantPro(user: User): Promise<StageResponseDto[]> {
    const stages = await this.stageRepository.find({
      where: { encadrantProId: user.id },
      relations: ['subject', 'student', 'encadrantPro', 'encadrantAcad'],
      order: { createdAt: 'DESC' },
    });
    return stages.map((s) => this.mapToResponse(s));
  }

  async getMyStagesAsEncadrantAcad(user: User): Promise<StageResponseDto[]> {
    const stages = await this.stageRepository.find({
      where: { encadrantAcadId: user.id },
      relations: ['subject', 'student', 'encadrantPro', 'encadrantAcad'],
      order: { createdAt: 'DESC' },
    });
    return stages.map((s) => this.mapToResponse(s));
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async loadFullStage(stageId: string): Promise<Stage> {
    const stage = await this.stageRepository.findOne({
      where: { id: stageId },
      relations: ['subject', 'student', 'encadrantPro', 'encadrantAcad', 'candidature'],
    });
    if (!stage) throw new NotFoundException(`Stage ${stageId} not found`);
    return stage;
  }

  private async findSubjectById(subjectId: string): Promise<Subject> {
    const subject = await this.subjectRepository.findOne({
      where: { id: subjectId },
      relations: ['createdBy', 'createdBy.roles'],
    });
    if (!subject) {
      throw new NotFoundException(`Subject ${subjectId} not found`);
    }
    return subject;
  }

  private async findSubjectByTitle(title: string): Promise<Subject> {
    const subject = await this.subjectRepository.findOne({
      where: { title },
      relations: ['createdBy', 'createdBy.roles'],
    });
    if (!subject) {
      throw new NotFoundException(`Subject with title "${title}" not found`);
    }
    return subject;
  }

  private async resolveEncadrantPro(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    const isPro = user.roles.some((r) => r.name === SYSTEM_ROLES.ENCADRANT_PRO);
    if (!isPro) {
      throw new BadRequestException(
        `User ${user.email} does not have the encadrant_pro role`,
      );
    }
    return user;
  }

  private async resolveEncadrantProByEmail(email: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['roles'],
    });
    if (!user) throw new NotFoundException(`User with email ${email} not found`);

    const isPro = user.roles.some((r) => r.name === SYSTEM_ROLES.ENCADRANT_PRO);
    if (!isPro) {
      throw new BadRequestException(
        `User ${email} does not have the encadrant_pro role`,
      );
    }
    return user;
  }

  private async resolveEncadrantAcad(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    const isAcad = user.roles.some((r) => r.name === SYSTEM_ROLES.ENCADRANT_ACADEMIQUE);
    if (!isAcad) {
      throw new BadRequestException(
        `User ${user.email} does not have the encadrant_academique role`,
      );
    }
    return user;
  }

  private async resolveEncadrantAcadByEmail(email: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['roles'],
    });
    if (!user) throw new NotFoundException(`User with email ${email} not found`);

    const isAcad = user.roles.some((r) => r.name === SYSTEM_ROLES.ENCADRANT_ACADEMIQUE);
    if (!isAcad) {
      throw new BadRequestException(
        `User ${email} does not have the encadrant_academique role`,
      );
    }
    return user;
  }

  private hasRole(user: User, roleName: string): boolean {
    return user?.roles?.some((role) => role.name === roleName) ?? false;
  }

  private hasAnyRole(user: User, roleNames: string[]): boolean {
    return roleNames.some((roleName) => this.hasRole(user, roleName));
  }

  private isValidAutoStageSupervisor(user: User): boolean {
    return this.hasAnyRole(user, [
      SYSTEM_ROLES.ENCADRANT_PRO,
      SYSTEM_ROLES.ADMIN_FORMATION,
      SYSTEM_ROLES.SUPER_ADMIN,
    ]);
  }

  private mapToResponse(stage: Stage): StageResponseDto {
    return {
      id: stage.id,
      status: stage.status,
      candidatureId: stage.candidatureId,
      subject: {
        id: stage.subject.id,
        title: stage.subject.title,
        level: stage.subject.level,
        technologies: stage.subject.technologies,
      },
      student: {
        id: stage.student.id,
        firstName: stage.student.firstName,
        lastName: stage.student.lastName,
        email: stage.student.email,
      },
      encadrantPro: {
        id: stage.encadrantPro.id,
        firstName: stage.encadrantPro.firstName,
        lastName: stage.encadrantPro.lastName,
        email: stage.encadrantPro.email,
      },
      encadrantAcad: stage.encadrantAcad
        ? {
            id: stage.encadrantAcad.id,
            firstName: stage.encadrantAcad.firstName,
            lastName: stage.encadrantAcad.lastName,
            email: stage.encadrantAcad.email,
          }
        : null,
      startDate: stage.startDate,
      endDate: stage.endDate,
      adminNotes: stage.adminNotes,
      createdAt: stage.createdAt,
      updatedAt: stage.updatedAt,
    };
  }
}
