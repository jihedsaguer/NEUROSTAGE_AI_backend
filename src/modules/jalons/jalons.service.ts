import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Jalon, JalonStatus } from './entities/jalon.entity';
import { Livrable } from './entities/livrable.entity';
import { Stage, StageStatus } from '../stages/entities/stage.entity';
import { User } from '../users/entities/user.entity';
import { CreateJalonDto } from './dto/create-jalon.dto';
import { UpdateJalonDto } from './dto/update-jalon.dto';
import { SubmitLivrableDto } from './dto/submit-livrable.dto';
import { ValidateJalonDto } from './dto/validate-jalon.dto';
import { AcadCommentDto } from './dto/acad-comment.dto';
import { JalonResponseDto, LivrableResponseDto, UserSummaryDto } from './dto/jalon-response.dto';
import { SYSTEM_ROLES } from '../roles/constants/roles.constants';

@Injectable()
export class JalonsService {
  constructor(
    @InjectRepository(Jalon)
    private readonly jalonRepository: Repository<Jalon>,
    @InjectRepository(Livrable)
    private readonly livrableRepository: Repository<Livrable>,
    @InjectRepository(Stage)
    private readonly stageRepository: Repository<Stage>,
  ) {}

  // ─── Task 3.1 — Create a jalon ───────────────────────────────────────────────

  async createJalon(dto: CreateJalonDto, user: User): Promise<JalonResponseDto> {
    // Requirement 1.1 / 1.2 — Stage must exist and be ACTIVE
    const stage = await this.stageRepository.findOne({
      where: { id: dto.stageId },
    });

    if (!stage) {
      throw new NotFoundException(`Stage ${dto.stageId} not found`);
    }

    if (stage.status !== StageStatus.ACTIVE) {
      throw new BadRequestException(
        `Stage ${dto.stageId} is not ACTIVE (current status: ${stage.status})`,
      );
    }

    // Requirement 1.4 — order must be unique within the stage
    const existing = await this.jalonRepository.findOne({
      where: { stageId: dto.stageId, order: dto.order },
    });

    if (existing) {
      throw new ConflictException(
        `A jalon with order ${dto.order} already exists in stage ${dto.stageId}`,
      );
    }

    // Requirement 1.3 — persist with initial status PENDING
    const jalon = this.jalonRepository.create({
      stageId: dto.stageId,
      label: dto.label,
      description: dto.description ?? null,
      dueDate: new Date(dto.dueDate),
      order: dto.order,
      status: JalonStatus.PENDING,
    });

    const saved = await this.jalonRepository.save(jalon);
    return this.mapToResponse(saved);
  }

  // ─── Task 3.4 — Update a jalon ───────────────────────────────────────────────

  async updateJalon(id: string, dto: UpdateJalonDto, user: User): Promise<JalonResponseDto> {
    const jalon = await this.jalonRepository.findOne({ where: { id } });

    if (!jalon) {
      throw new NotFoundException(`Jalon ${id} not found`);
    }

    // Requirement 1.5 / 1.6 — only updatable when PENDING
    if (jalon.status !== JalonStatus.PENDING) {
      throw new ConflictException(
        `Jalon ${id} cannot be updated because its status is ${jalon.status} (must be PENDING)`,
      );
    }

    if (dto.label !== undefined) jalon.label = dto.label;
    if (dto.description !== undefined) jalon.description = dto.description ?? null;
    if (dto.dueDate !== undefined) jalon.dueDate = new Date(dto.dueDate);
    if (dto.order !== undefined) {
      // Check uniqueness of new order within the stage (excluding current jalon)
      const conflict = await this.jalonRepository.findOne({
        where: { stageId: jalon.stageId, order: dto.order },
      });
      if (conflict && conflict.id !== jalon.id) {
        throw new ConflictException(
          `A jalon with order ${dto.order} already exists in stage ${jalon.stageId}`,
        );
      }
      jalon.order = dto.order;
    }

    const saved = await this.jalonRepository.save(jalon);
    return this.mapToResponse(saved);
  }

  // ─── Task 3.5 — Delete a jalon ───────────────────────────────────────────────

  async deleteJalon(id: string, user: User): Promise<void> {
    const jalon = await this.jalonRepository.findOne({ where: { id } });

    if (!jalon) {
      throw new NotFoundException(`Jalon ${id} not found`);
    }

    // Requirement 1.7 / 1.8 — only deletable when PENDING
    if (jalon.status !== JalonStatus.PENDING) {
      throw new ConflictException(
        `Jalon ${id} cannot be deleted because its status is ${jalon.status} (must be PENDING)`,
      );
    }

    await this.jalonRepository.remove(jalon);
  }

  // ─── Task 4.1 — List jalons for a stage (role-scoped) ────────────────────────

  async getJalonsForStage(stageId: string, user: User): Promise<JalonResponseDto[]> {
    // Requirement 2.1 — stage must exist
    const stage = await this.stageRepository.findOne({ where: { id: stageId } });
    if (!stage) {
      throw new NotFoundException(`Stage ${stageId} not found`);
    }

    // Requirements 2.2–2.6 — role-based access scoping
    const userRoles = (user.roles ?? []).map((r) => r.name);

    if (userRoles.includes(SYSTEM_ROLES.STUDENT)) {
      if (stage.studentId !== user.id) {
        throw new ForbiddenException('Access denied: you are not the student of this stage');
      }
    } else if (userRoles.includes(SYSTEM_ROLES.ENCADRANT_PRO)) {
      if (stage.encadrantProId !== user.id) {
        throw new ForbiddenException('Access denied: you are not the professional supervisor of this stage');
      }
    } else if (userRoles.includes(SYSTEM_ROLES.ENCADRANT_ACADEMIQUE)) {
      if (stage.encadrantAcadId !== user.id) {
        throw new ForbiddenException('Access denied: you are not the academic supervisor of this stage');
      }
    }
    // admin_formation and super_admin: no restriction

    const jalons = await this.jalonRepository.find({
      where: { stageId },
      relations: ['livrable'],
      order: { order: 'ASC' },
    });

    return jalons.map((j) => this.mapToResponse(j));
  }

  // ─── Task 4.2 — Get a single jalon by id (role-scoped) ───────────────────────

  async getJalonById(id: string, user: User): Promise<JalonResponseDto> {
    // Requirement 2.7 — load with livrable and validatedBy
    const jalon = await this.jalonRepository.findOne({
      where: { id },
      relations: ['livrable', 'validatedBy'],
    });

    if (!jalon) {
      throw new NotFoundException(`Jalon ${id} not found`);
    }

    // Load stage to apply role-based scoping (same rules as getJalonsForStage)
    const stage = await this.stageRepository.findOne({ where: { id: jalon.stageId } });
    if (!stage) {
      throw new NotFoundException(`Stage ${jalon.stageId} not found`);
    }

    const userRoles = (user.roles ?? []).map((r) => r.name);

    if (userRoles.includes(SYSTEM_ROLES.STUDENT)) {
      if (stage.studentId !== user.id) {
        throw new ForbiddenException('Access denied: you are not the student of this stage');
      }
    } else if (userRoles.includes(SYSTEM_ROLES.ENCADRANT_PRO)) {
      if (stage.encadrantProId !== user.id) {
        throw new ForbiddenException('Access denied: you are not the professional supervisor of this stage');
      }
    } else if (userRoles.includes(SYSTEM_ROLES.ENCADRANT_ACADEMIQUE)) {
      if (stage.encadrantAcadId !== user.id) {
        throw new ForbiddenException('Access denied: you are not the academic supervisor of this stage');
      }
    }

    return this.mapToResponse(jalon);
  }

  // ─── Task 6.1 — Submit a livrable ────────────────────────────────────────────

  async submitLivrable(jalonId: string, dto: SubmitLivrableDto, user: User): Promise<JalonResponseDto> {
    // Load jalon with livrable and stage relations
    const jalon = await this.jalonRepository.findOne({
      where: { id: jalonId },
      relations: ['livrable', 'stage'],
    });

    if (!jalon) {
      throw new NotFoundException(`Jalon ${jalonId} not found`);
    }

    // Requirements 3.1, 3.2 — jalon must belong to the student's stage
    if (jalon.stage.studentId !== user.id) {
      throw new ForbiddenException('Access denied: this jalon does not belong to your stage');
    }

    // Requirements 3.3, 3.4 — status must be PENDING or REJECTED (not VALIDATED)
    const persistedStatus = jalon.status;
    if (persistedStatus === JalonStatus.VALIDATED) {
      throw new ConflictException(
        `Jalon ${jalonId} cannot receive a livrable because its status is VALIDATED`,
      );
    }

    // Requirements 3.7, 7.1, 7.2 — upsert: update existing livrable or create a new one
    let livrable = jalon.livrable;

    if (livrable) {
      // Update existing livrable fields
      livrable.fileName = dto.fileName;
      livrable.fileUrl = dto.fileUrl;
      livrable.fileType = dto.fileType;
      livrable.size = dto.size;
      livrable.hash = dto.hash;
      livrable.studentNote = dto.studentNote ?? null;
    } else {
      // Create a new livrable
      livrable = this.livrableRepository.create({
        jalonId,
        studentId: user.id,
        fileName: dto.fileName,
        fileUrl: dto.fileUrl,
        fileType: dto.fileType,
        size: dto.size,
        hash: dto.hash,
        studentNote: dto.studentNote ?? null,
      });
    }

    // Requirement 3.9 — always reset scanOk to false on every submission
    livrable.scanOk = false;
    // Requirement 3.5 — persist submittedAt and studentId
    livrable.submittedAt = new Date();
    livrable.studentId = user.id;

    const savedLivrable = await this.livrableRepository.save(livrable);

    // Requirement 3.6 — update jalon status to SUBMITTED
    jalon.status = JalonStatus.SUBMITTED;
    const savedJalon = await this.jalonRepository.save(jalon);

    return this.mapToResponse(savedJalon, savedLivrable);
  }

  // ─── Task 6.2 — Get livrable for a jalon ─────────────────────────────────────

  async getLivrable(jalonId: string, user: User): Promise<LivrableResponseDto> {
    // Load jalon with livrable and stage relations
    const jalon = await this.jalonRepository.findOne({
      where: { id: jalonId },
      relations: ['livrable', 'stage'],
    });

    if (!jalon) {
      throw new NotFoundException(`Jalon ${jalonId} not found`);
    }

    // Requirements 2.1–2.6 — same role-based scoping as getJalonsForStage
    const stage = jalon.stage;
    const userRoles = (user.roles ?? []).map((r) => r.name);

    if (userRoles.includes(SYSTEM_ROLES.STUDENT)) {
      if (stage.studentId !== user.id) {
        throw new ForbiddenException('Access denied: you are not the student of this stage');
      }
    } else if (userRoles.includes(SYSTEM_ROLES.ENCADRANT_PRO)) {
      if (stage.encadrantProId !== user.id) {
        throw new ForbiddenException('Access denied: you are not the professional supervisor of this stage');
      }
    } else if (userRoles.includes(SYSTEM_ROLES.ENCADRANT_ACADEMIQUE)) {
      if (stage.encadrantAcadId !== user.id) {
        throw new ForbiddenException('Access denied: you are not the academic supervisor of this stage');
      }
    }
    // admin_formation and super_admin: no restriction

    if (!jalon.livrable) {
      throw new NotFoundException(`No livrable found for jalon ${jalonId}`);
    }

    const l = jalon.livrable;
    // Requirement 7.4 — hash must NOT be included in the response
    return {
      id: l.id,
      jalonId: l.jalonId,
      studentId: l.studentId,
      fileName: l.fileName,
      fileUrl: l.fileUrl,
      fileType: l.fileType,
      size: l.size,
      scanOk: l.scanOk,
      studentNote: l.studentNote,
      submittedAt: l.submittedAt,
    };
  }

  // ─── Task 7.1 — Validate or reject a jalon (encadrant_pro) ──────────────────

  async validateJalon(id: string, dto: ValidateJalonDto, user: User): Promise<JalonResponseDto> {
    // Load jalon with all relations needed for the response and access checks
    const jalon = await this.jalonRepository.findOne({
      where: { id },
      relations: ['livrable', 'stage', 'validatedBy'],
    });

    if (!jalon) {
      throw new NotFoundException(`Jalon ${id} not found`);
    }

    // Requirements 4.1, 4.2 — encadrant_pro must be assigned to this stage
    if (jalon.stage.encadrantProId !== user.id) {
      throw new ForbiddenException(
        'Access denied: you are not the professional supervisor of this stage',
      );
    }

    // Requirements 4.3, 4.4 — jalon must be in SUBMITTED status
    if (jalon.status !== JalonStatus.SUBMITTED) {
      throw new ConflictException(
        `Jalon ${id} cannot be validated/rejected because its status is ${jalon.status} (must be SUBMITTED)`,
      );
    }

    // Requirement 4.7 — REJECT requires a non-empty proComment
    if (dto.action === 'REJECT' && !dto.proComment?.trim()) {
      throw new BadRequestException('A comment is required when rejecting a jalon');
    }

    // Requirements 4.5, 4.6 — apply the action
    jalon.status = dto.action === 'VALIDATE' ? JalonStatus.VALIDATED : JalonStatus.REJECTED;
    jalon.validatedById = user.id;
    jalon.validatedBy = user;
    jalon.validatedAt = new Date();
    jalon.proComment = dto.proComment ?? null;

    const saved = await this.jalonRepository.save(jalon);
    return this.mapToResponse(saved);
  }

  // ─── Task 7.2 — Add academic comment (encadrant_academique) ──────────────────

  async addAcadComment(id: string, dto: AcadCommentDto, user: User): Promise<JalonResponseDto> {
    // Load jalon with relations needed for access check and response
    const jalon = await this.jalonRepository.findOne({
      where: { id },
      relations: ['livrable', 'stage'],
    });

    if (!jalon) {
      throw new NotFoundException(`Jalon ${id} not found`);
    }

    // Requirements 5.1, 5.2 — encadrant_acad must be assigned to this stage
    if (jalon.stage.encadrantAcadId !== user.id) {
      throw new ForbiddenException(
        'Access denied: you are not the academic supervisor of this stage',
      );
    }

    // Requirements 5.3, 5.4 — persist acadComment regardless of jalon status
    jalon.acadComment = dto.acadComment;

    const saved = await this.jalonRepository.save(jalon);
    return this.mapToResponse(saved);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  // Task 4.3 — Compute dynamic LATE status (Requirements 6.1, 6.2)
  // Pure function — no DB calls. Never mutates the persisted status.
  private computeStatus(jalon: Jalon): JalonStatus {
    const now = new Date();
    const dueDate = new Date(jalon.dueDate);
    const isOverdue = dueDate < now;
    const isOpenStatus =
      jalon.status === JalonStatus.PENDING || jalon.status === JalonStatus.SUBMITTED;

    if (isOverdue && isOpenStatus) {
      return JalonStatus.LATE;
    }
    return jalon.status;
  }

  private mapToResponse(jalon: Jalon, livrable?: Livrable | null): JalonResponseDto {
    let livrableDto: LivrableResponseDto | null = null;
    const livrableSource = livrable !== undefined ? livrable : jalon.livrable;

    if (livrableSource) {
      livrableDto = {
        id: livrableSource.id,
        jalonId: livrableSource.jalonId,
        studentId: livrableSource.studentId,
        fileName: livrableSource.fileName,
        fileUrl: livrableSource.fileUrl,
        fileType: livrableSource.fileType,
        size: livrableSource.size,
        scanOk: livrableSource.scanOk,
        studentNote: livrableSource.studentNote,
        submittedAt: livrableSource.submittedAt,
      };
    }

    let validatedByDto: UserSummaryDto | null = null;
    if (jalon.validatedBy) {
      validatedByDto = {
        id: jalon.validatedBy.id,
        email: jalon.validatedBy.email,
        firstName: jalon.validatedBy.firstName,
        lastName: jalon.validatedBy.lastName,
      };
    }

    return {
      id: jalon.id,
      stageId: jalon.stageId,
      label: jalon.label,
      description: jalon.description,
      dueDate: jalon.dueDate,
      order: jalon.order,
      status: this.computeStatus(jalon),
      validatedBy: validatedByDto,
      validatedAt: jalon.validatedAt,
      proComment: jalon.proComment,
      acadComment: jalon.acadComment,
      livrable: livrableDto,
      createdAt: jalon.createdAt,
      updatedAt: jalon.updatedAt,
    };
  }
}
