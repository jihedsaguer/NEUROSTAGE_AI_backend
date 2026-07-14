import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThan, IsNull } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { StudentProfile } from '../profiles/entities/profiles.entity';
import { Subject, SubjectStatus } from '../subjects/entities/subject.entity';
import { Candidature, CandidatureStatus } from '../candidatures/entities/candidature.entity';
import { Stage, StageStatus } from '../stages/entities/stage.entity';
import { Jalon, JalonStatus } from '../jalons/entities/jalon.entity';
import { Livrable } from '../jalons/entities/livrable.entity';
import { GenerationIA } from '../ai/entities/generation-ia.entity';
import { SYSTEM_ROLES } from '../roles/constants/roles.constants';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(StudentProfile)
    private readonly profileRepo: Repository<StudentProfile>,
    @InjectRepository(Subject)
    private readonly subjectRepo: Repository<Subject>,
    @InjectRepository(Candidature)
    private readonly candidatureRepo: Repository<Candidature>,
    @InjectRepository(Stage)
    private readonly stageRepo: Repository<Stage>,
    @InjectRepository(Jalon)
    private readonly jalonRepo: Repository<Jalon>,
    @InjectRepository(GenerationIA)
    private readonly generationRepo: Repository<GenerationIA>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── ADMIN OVERVIEW ──────────────────────────────────────────────────────────

  async getAdminOverview() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // ── Users ──
    const totalUsers = await this.userRepo.count();
    const students = await this.userRepo
      .createQueryBuilder('u')
      .innerJoin('u.roles', 'r')
      .where('r.name = :role', { role: SYSTEM_ROLES.STUDENT })
      .getCount();
    const encadreurs = await this.userRepo
      .createQueryBuilder('u')
      .innerJoin('u.roles', 'r')
      .where('r.name = :role', { role: SYSTEM_ROLES.ENCADRANT_PRO })
      .getCount();
    const verified = await this.userRepo.count({ where: { isEmailVerified: true } });
    const newUsersThisMonth = await this.userRepo.count({
      where: { createdAt: MoreThan(startOfMonth) },
    });

    // ── Subjects ──
    const totalSubjects = await this.subjectRepo.count();
    const subjectDraft = await this.subjectRepo.count({ where: { status: SubjectStatus.DRAFT } });
    const subjectPending = await this.subjectRepo.count({ where: { status: SubjectStatus.PENDING } });
    const subjectValidated = await this.subjectRepo.count({ where: { status: SubjectStatus.VALIDATED } });
    const subjectRejected = await this.subjectRepo.count({ where: { status: SubjectStatus.REJECTED } });
    const subjectAi = await this.subjectRepo.count({ where: { generatedByAi: true } });
    const subjectNewThisMonth = await this.subjectRepo.count({
      where: { createdAt: MoreThan(startOfMonth) },
    });

    // ── Candidatures ──
    const totalCandidatures = await this.candidatureRepo.count();
    const candidaturePending = await this.candidatureRepo.count({ where: { status: CandidatureStatus.PENDING } });
    const candidatureAccepted = await this.candidatureRepo.count({ where: { status: CandidatureStatus.ACCEPTED } });
    const candidatureRejected = await this.candidatureRepo.count({ where: { status: CandidatureStatus.REJECTED } });
    const conversionRate = totalCandidatures > 0
      ? Math.round((candidatureAccepted / totalCandidatures) * 100 * 10) / 10
      : 0;

    // ── Stages ──
    const totalStages = await this.stageRepo.count();
    const stageActive = await this.stageRepo.count({ where: { status: StageStatus.ACTIVE } });
    const stageCompleted = await this.stageRepo.count({ where: { status: StageStatus.COMPLETED } });
    const stageCancelled = await this.stageRepo.count({ where: { status: StageStatus.CANCELLED } });
    const stagesWithoutPro = await this.stageRepo.count({ where: { encadrantProId: IsNull() } });
    const stagesWithoutAcad = await this.stageRepo.count({ where: { encadrantAcadId: IsNull() } });

    // ── Jalons ──
    const totalJalons = await this.jalonRepo.count();
    const jalonPending = await this.jalonRepo.count({ where: { status: JalonStatus.PENDING } });
    const jalonSubmitted = await this.jalonRepo.count({ where: { status: JalonStatus.SUBMITTED } });
    const jalonValidated = await this.jalonRepo.count({ where: { status: JalonStatus.VALIDATED } });
    const jalonOverdue = await this.jalonRepo
      .createQueryBuilder('j')
      .where('j.dueDate < :now', { now })
      .andWhere('j.status != :validated', { validated: JalonStatus.VALIDATED })
      .andWhere('j.status != :rejected', { rejected: JalonStatus.REJECTED })
      .getCount();
    const jalonCompletionRate = totalJalons > 0
      ? Math.round((jalonValidated / totalJalons) * 100 * 10) / 10
      : 0;

    // ── AI usage ──
    const totalGenerations = await this.generationRepo.count();
    const studentsWithCv = await this.profileRepo.count({ where: { isAiProcessed: true } });
    let subjectsIndexed = 0;
    try {
      const rows = await this.dataSource.query('SELECT COUNT(*) as count FROM subject_embeddings');
      subjectsIndexed = parseInt(rows[0]?.count ?? '0', 10);
    } catch {
      subjectsIndexed = 0;
    }

    return {
      users: {
        total: totalUsers,
        students,
        encadreurs,
        verified,
        unverified: totalUsers - verified,
        newThisMonth: newUsersThisMonth,
      },
      subjects: {
        total: totalSubjects,
        draft: subjectDraft,
        pending: subjectPending,
        validated: subjectValidated,
        rejected: subjectRejected,
        aiGenerated: subjectAi,
        newThisMonth: subjectNewThisMonth,
      },
      candidatures: {
        total: totalCandidatures,
        pending: candidaturePending,
        accepted: candidatureAccepted,
        rejected: candidatureRejected,
        conversionRate,
      },
      stages: {
        total: totalStages,
        active: stageActive,
        completed: stageCompleted,
        cancelled: stageCancelled,
        withoutEncadreur: stagesWithoutPro,
        withoutAcadEncadreur: stagesWithoutAcad,
      },
      jalons: {
        total: totalJalons,
        pending: jalonPending,
        submitted: jalonSubmitted,
        validated: jalonValidated,
        overdue: jalonOverdue,
        completionRate: jalonCompletionRate,
      },
      ai: {
        totalGenerations,
        studentsWithCv,
        subjectsIndexed,
      },
    };
  }

  // ─── SUBJECTS BY LEVEL ───────────────────────────────────────────────────────

  async getSubjectsByLevel() {
    const rows = await this.subjectRepo
      .createQueryBuilder('s')
      .select('s.level', 'level')
      .addSelect('COUNT(*)', 'count')
      .addSelect(
        `SUM(CASE WHEN s.status = '${SubjectStatus.VALIDATED}' THEN 1 ELSE 0 END)`,
        'validated',
      )
      .groupBy('s.level')
      .orderBy('count', 'DESC')
      .getRawMany();

    return rows.map((r) => ({
      level: r.level ?? 'Unknown',
      count: parseInt(r.count, 10),
      validated: parseInt(r.validated, 10),
    }));
  }

  // ─── CANDIDATURES TIMELINE ───────────────────────────────────────────────────

  async getCandidaturesTimeline() {
    const rows = await this.candidatureRepo
      .createQueryBuilder('c')
      .select(`TO_CHAR(c."createdAt", 'YYYY-MM')`, 'month')
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        `SUM(CASE WHEN c.status = '${CandidatureStatus.ACCEPTED}' THEN 1 ELSE 0 END)`,
        'accepted',
      )
      .addSelect(
        `SUM(CASE WHEN c.status = '${CandidatureStatus.REJECTED}' THEN 1 ELSE 0 END)`,
        'rejected',
      )
      .where(`c."createdAt" >= NOW() - INTERVAL '6 months'`)
      .groupBy(`TO_CHAR(c."createdAt", 'YYYY-MM')`)
      .orderBy('month', 'ASC')
      .getRawMany();

    return rows.map((r) => ({
      month: r.month,
      total: parseInt(r.total, 10),
      accepted: parseInt(r.accepted, 10),
      rejected: parseInt(r.rejected, 10),
    }));
  }

  // ─── STAGES PER UNIVERSITY ───────────────────────────────────────────────────

  async getStagesPerUniversity() {
    const rows = await this.dataSource.query(`
      SELECT
        sp.university,
        COUNT(st.id)::int AS count
      FROM stages st
      INNER JOIN student_profiles sp ON sp."userId" = st.student_id::text
      WHERE sp.university IS NOT NULL
      GROUP BY sp.university
      ORDER BY count DESC
      LIMIT 10
    `);

    return rows.map((r: any) => ({
      university: r.university as string,
      count: typeof r.count === 'number' ? r.count : parseInt(r.count, 10),
    }));
  }

  // ─── PENDING ACTIONS ─────────────────────────────────────────────────────────

  async getPendingActions() {
    const now = new Date();

    const subjectsPendingValidation = await this.subjectRepo.count({
      where: { status: SubjectStatus.PENDING },
    });

    const candidaturesPendingReview = await this.candidatureRepo.count({
      where: { status: CandidatureStatus.PENDING },
    });

    const stagesWithoutEncadreur = await this.stageRepo.count({
      where: { encadrantProId: IsNull() },
    });

    const jalonsOverdue = await this.jalonRepo
      .createQueryBuilder('j')
      .where('j.dueDate < :now', { now })
      .andWhere('j.status != :validated', { validated: JalonStatus.VALIDATED })
      .andWhere('j.status != :rejected', { rejected: JalonStatus.REJECTED })
      .getCount();

    // Students with accepted candidature but no stage
    const rows = await this.dataSource.query(`
      SELECT COUNT(*)::int AS count
      FROM candidature c
      LEFT JOIN stages s ON s.candidature_id = c.id
      WHERE c.status = 'accepted'
        AND s.id IS NULL
    `);
    const studentsWithoutStage = parseInt(rows[0]?.count ?? '0', 10);

    return {
      subjectsPendingValidation,
      candidaturesPendingReview,
      stagesWithoutEncadreur,
      jalonsOverdue,
      studentsWithoutStage,
    };
  }

  // ─── RECENT ACTIVITY ─────────────────────────────────────────────────────────

  async getRecentActivity() {
    // Pull recent events from entity tables — audit_logs optional fallback
    const events: Array<{
      type: string;
      actorName: string;
      targetName: string;
      createdAt: Date;
    }> = [];

    // Recent user registrations
    const recentUsers = await this.userRepo.find({
      order: { createdAt: 'DESC' },
      take: 5,
      relations: ['roles'],
    });
    for (const u of recentUsers) {
      events.push({
        type: 'USER_REGISTERED',
        actorName: `${u.firstName} ${u.lastName}`,
        targetName: u.roles?.[0]?.name ?? 'user',
        createdAt: u.createdAt,
      });
    }

    // Recent subjects created
    const recentSubjects = await this.subjectRepo.find({
      order: { createdAt: 'DESC' },
      take: 5,
      relations: ['createdBy'],
    });
    for (const s of recentSubjects) {
      events.push({
        type: 'SUBJECT_CREATED',
        actorName: s.createdBy ? `${s.createdBy.firstName} ${s.createdBy.lastName}` : 'Unknown',
        targetName: s.title,
        createdAt: s.createdAt,
      });
    }

    // Recent accepted candidatures
    const recentCandidatures = await this.candidatureRepo.find({
      where: { status: CandidatureStatus.ACCEPTED },
      order: { updatedAt: 'DESC' },
      take: 5,
    });
    for (const c of recentCandidatures) {
      events.push({
        type: 'CANDIDATURE_ACCEPTED',
        actorName: c.student ? `${c.student.firstName} ${c.student.lastName}` : 'Unknown',
        targetName: c.subject?.title ?? 'Unknown subject',
        createdAt: c.updatedAt,
      });
    }

    // Recent stages started (ACTIVE)
    const recentStages = await this.stageRepo.find({
      where: { status: StageStatus.ACTIVE },
      order: { updatedAt: 'DESC' },
      take: 5,
      relations: ['student', 'subject'],
    });
    for (const s of recentStages) {
      events.push({
        type: 'STAGE_STARTED',
        actorName: s.student ? `${s.student.firstName} ${s.student.lastName}` : 'Unknown',
        targetName: s.subject?.title ?? 'Unknown subject',
        createdAt: s.updatedAt,
      });
    }

    // Recent validated jalons
    const recentJalons = await this.jalonRepo.find({
      where: { status: JalonStatus.VALIDATED },
      order: { validatedAt: 'DESC' },
      take: 5,
      relations: ['validatedBy'],
    });
    for (const j of recentJalons) {
      events.push({
        type: 'JALON_VALIDATED',
        actorName: j.validatedBy
          ? `${j.validatedBy.firstName} ${j.validatedBy.lastName}`
          : 'Unknown',
        targetName: j.label,
        createdAt: j.validatedAt ?? j.updatedAt,
      });
    }

    // Sort by most recent and cap at 20
    return events
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20);
  }

  // ─── ENCADREUR OVERVIEW ──────────────────────────────────────────────────────

  async getEncadreurOverview(encadreurId: string) {
    const now = new Date();

    // ── My stages ──
    const totalStages = await this.stageRepo.count({ where: { encadrantProId: encadreurId } });
    const activeStages = await this.stageRepo.count({
      where: { encadrantProId: encadreurId, status: StageStatus.ACTIVE },
    });
    const completedStages = await this.stageRepo.count({
      where: { encadrantProId: encadreurId, status: StageStatus.COMPLETED },
    });

    // ── Students ──
    const totalStudents = await this.stageRepo
      .createQueryBuilder('s')
      .where('s.encadrantProId = :id', { id: encadreurId })
      .select('COUNT(DISTINCT s.studentId)', 'count')
      .getRawOne()
      .then((r) => parseInt(r?.count ?? '0', 10));

    const withActiveStage = await this.stageRepo.count({
      where: { encadrantProId: encadreurId, status: StageStatus.ACTIVE },
    });

    // Students with at least one overdue jalon
    const overdueStudentRows = await this.dataSource.query(`
      SELECT COUNT(DISTINCT s.student_id)::int AS count
      FROM stages s
      INNER JOIN jalons j ON j.stage_id = s.id
      WHERE s.encadrant_pro_id = $1
        AND j.due_date < NOW()
        AND j.status NOT IN ('${JalonStatus.VALIDATED}', '${JalonStatus.REJECTED}')
    `, [encadreurId]);
    const withOverdueJalon = parseInt(overdueStudentRows[0]?.count ?? '0', 10);

    // ── Jalons across my stages ──
    const myStageIds = await this.stageRepo
      .createQueryBuilder('s')
      .select('s.id', 'id')
      .where('s.encadrantProId = :id', { id: encadreurId })
      .getRawMany()
      .then((rows) => rows.map((r) => r.id as string));

    let jalonTotals = { total: 0, pendingValidation: 0, validated: 0, overdue: 0 };
    if (myStageIds.length > 0) {
      const jalonAgg = await this.jalonRepo
        .createQueryBuilder('j')
        .where('j.stageId IN (:...ids)', { ids: myStageIds })
        .select('COUNT(*)', 'total')
        .addSelect(`SUM(CASE WHEN j.status = '${JalonStatus.SUBMITTED}' THEN 1 ELSE 0 END)`, 'submitted')
        .addSelect(`SUM(CASE WHEN j.status = '${JalonStatus.VALIDATED}' THEN 1 ELSE 0 END)`, 'validated')
        .addSelect(
          `SUM(CASE WHEN j.dueDate < :now AND j.status NOT IN ('${JalonStatus.VALIDATED}','${JalonStatus.REJECTED}') THEN 1 ELSE 0 END)`,
          'overdue',
        )
        .setParameter('now', now)
        .getRawOne();

      jalonTotals = {
        total: parseInt(jalonAgg?.total ?? '0', 10),
        pendingValidation: parseInt(jalonAgg?.submitted ?? '0', 10),
        validated: parseInt(jalonAgg?.validated ?? '0', 10),
        overdue: parseInt(jalonAgg?.overdue ?? '0', 10),
      };
    }

    // ── My subjects ──
    const subjectDraft = await this.subjectRepo.count({
      where: { createdBy: { id: encadreurId }, status: SubjectStatus.DRAFT },
    });
    const subjectPending = await this.subjectRepo.count({
      where: { createdBy: { id: encadreurId }, status: SubjectStatus.PENDING },
    });
    const subjectValidated = await this.subjectRepo.count({
      where: { createdBy: { id: encadreurId }, status: SubjectStatus.VALIDATED },
    });
    const totalSubjects = await this.subjectRepo.count({
      where: { createdBy: { id: encadreurId } },
    });

    // ── Pending actions ──
    // Jalons to validate = submitted jalons in my stages
    const jalonsToValidate = jalonTotals.pendingValidation;

    // Candidatures to review = PENDING candidatures for subjects I created
    const mySubjectIds = await this.subjectRepo
      .createQueryBuilder('s')
      .select('s.id', 'id')
      .where('s.createdBy.id = :id', { id: encadreurId })
      .getRawMany()
      .then((rows) => rows.map((r) => r.s_id as string));

    let candidaturesToReview = 0;
    if (mySubjectIds.length > 0) {
      candidaturesToReview = await this.candidatureRepo
        .createQueryBuilder('c')
        .where('c.subject IN (:...ids)', { ids: mySubjectIds })
        .andWhere('c.status = :status', { status: CandidatureStatus.PENDING })
        .getCount();
    }

    return {
      stages: { total: totalStages, active: activeStages, completed: completedStages },
      students: { total: totalStudents, withActiveStage, withOverdueJalon },
      jalons: {
        totalAcrossMyStages: jalonTotals.total,
        pendingValidation: jalonTotals.pendingValidation,
        validated: jalonTotals.validated,
        overdue: jalonTotals.overdue,
      },
      subjects: {
        total: totalSubjects,
        draft: subjectDraft,
        pending: subjectPending,
        validated: subjectValidated,
      },
      pendingActions: { jalonsToValidate, candidaturesToReview },
    };
  }

  // ─── ENCADREUR MY STUDENTS ───────────────────────────────────────────────────

  async getEncadreurMyStudents(encadreurId: string) {
    const now = new Date();

    const stages = await this.stageRepo.find({
      where: { encadrantProId: encadreurId },
      relations: ['student', 'subject'],
    });

    if (stages.length === 0) return [];

    const results = await Promise.all(
      stages.map(async (stage) => {
        const jalons = await this.jalonRepo.find({
          where: { stageId: stage.id },
          relations: ['livrable'],
          order: { dueDate: 'ASC' },
        });

        const totalJalons = jalons.length;
        const validatedJalons = jalons.filter((j) => j.status === JalonStatus.VALIDATED).length;
        const overdueJalons = jalons.filter(
          (j) =>
            new Date(j.dueDate) < now &&
            j.status !== JalonStatus.VALIDATED &&
            j.status !== JalonStatus.REJECTED,
        ).length;

        const upcoming = jalons
          .filter((j) => new Date(j.dueDate) >= now && j.status !== JalonStatus.VALIDATED)
          .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

        const nextDeadline: Date | null = upcoming[0]?.dueDate
          ? new Date(upcoming[0].dueDate)
          : null;

        const completionPercentage =
          totalJalons > 0 ? Math.round((validatedJalons / totalJalons) * 100) : 0;

        // Last activity = most recent livrable submission
        const lastLivrable = jalons
          .filter((j) => j.livrable?.submittedAt)
          .sort(
            (a, b) =>
              new Date(b.livrable!.submittedAt).getTime() -
              new Date(a.livrable!.submittedAt).getTime(),
          )[0];
        const lastActivity: Date | null = lastLivrable?.livrable?.submittedAt ?? null;

        // Load student profile for university/level
        const profile = await this.profileRepo.findOne({
          where: { userId: stage.studentId },
        });

        return {
          stageId: stage.id,
          student: {
            id: stage.student?.id ?? stage.studentId,
            firstName: stage.student?.firstName ?? '',
            lastName: stage.student?.lastName ?? '',
            email: stage.student?.email ?? '',
            university: profile?.university ?? null,
            level: profile?.level ?? null,
          },
          subject: {
            id: stage.subject?.id ?? stage.subjectId,
            title: stage.subject?.title ?? '',
            level: stage.subject?.level ?? null,
          },
          stage: {
            status: stage.status,
            startDate: stage.startDate,
            endDate: stage.endDate,
          },
          jalons: { total: totalJalons, validated: validatedJalons, overdue: overdueJalons, nextDeadline },
          completionPercentage,
          lastActivity,
        };
      }),
    );

    // Sort by next deadline ASC (nulls last)
    return results.sort((a, b) => {
      if (!a.jalons.nextDeadline && !b.jalons.nextDeadline) return 0;
      if (!a.jalons.nextDeadline) return 1;
      if (!b.jalons.nextDeadline) return -1;
      return a.jalons.nextDeadline.getTime() - b.jalons.nextDeadline.getTime();
    });
  }

  // ─── ENCADREUR JALON ALERTS ──────────────────────────────────────────────────

  async getEncadreurJalonAlerts(encadreurId: string) {
    const now = new Date();

    const myStageIds = await this.stageRepo
      .createQueryBuilder('s')
      .select('s.id', 'id')
      .where('s.encadrantProId = :id', { id: encadreurId })
      .getRawMany()
      .then((rows) => rows.map((r) => r.id as string));

    if (myStageIds.length === 0) return [];

    const jalons = await this.jalonRepo
      .createQueryBuilder('j')
      .leftJoinAndSelect('j.livrable', 'livrable')
      .leftJoinAndSelect('j.stage', 'stage')
      .leftJoinAndSelect('stage.student', 'student')
      .where('j.stageId IN (:...ids)', { ids: myStageIds })
      .andWhere('j.status != :validated', { validated: JalonStatus.VALIDATED })
      .orderBy('j.dueDate', 'ASC')
      .take(20)
      .getMany();

    return jalons.map((j) => {
      const dueDate = new Date(j.dueDate);
      const msPerDay = 1000 * 60 * 60 * 24;
      const daysOverdue = Math.round((now.getTime() - dueDate.getTime()) / msPerDay);

      const student = j.stage?.student;
      const studentName = student
        ? `${student.firstName} ${student.lastName}`
        : 'Unknown';

      return {
        jalonId: j.id,
        jalonTitle: j.label,
        deadline: dueDate,
        status: j.status,
        daysOverdue,
        studentName,
        stageId: j.stageId,
        hasLivrable: !!j.livrable,
      };
    });
  }

  // ─── STUDENT OVERVIEW ────────────────────────────────────────────────────────

  async getStudentOverview(studentId: string) {
    const now = new Date();

    // ── Profile ──
    const profile = await this.profileRepo.findOne({ where: { userId: studentId } });
    const profileData = {
      completionPercentage: profile?.completionPercentage ?? 0,
      isAiProcessed: profile?.isAiProcessed ?? false,
      hasCV: false,
    };
    if (profile) {
      const cvCount = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM student_documents WHERE "profileId" = $1 AND type = 'CV'`,
        [profile.id],
      );
      profileData.hasCV = parseInt(cvCount[0]?.count ?? '0', 10) > 0;
    }

    // ── Candidatures ──
    const totalCandidatures = await this.candidatureRepo.count({
      where: { student: { id: studentId } },
    });
    const candPending = await this.candidatureRepo.count({
      where: { student: { id: studentId }, status: CandidatureStatus.PENDING },
    });
    const candAccepted = await this.candidatureRepo.count({
      where: { student: { id: studentId }, status: CandidatureStatus.ACCEPTED },
    });
    const candRejected = await this.candidatureRepo.count({
      where: { student: { id: studentId }, status: CandidatureStatus.REJECTED },
    });

    // ── Stage ──
    const stage = await this.stageRepo.findOne({
      where: { studentId },
      relations: ['subject', 'encadrantPro'],
    });

    let stageData: {
      hasActiveStage: boolean;
      status: string | null;
      subjectTitle: string | null;
      encadreurName: string | null;
      startDate: Date | null;
      endDate: Date | null;
      daysRemaining: number | null;
    } = {
      hasActiveStage: false,
      status: null,
      subjectTitle: null,
      encadreurName: null,
      startDate: null,
      endDate: null,
      daysRemaining: null,
    };

    if (stage) {
      const daysRemaining = stage.endDate
        ? Math.round((new Date(stage.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      stageData = {
        hasActiveStage: stage.status === StageStatus.ACTIVE,
        status: stage.status,
        subjectTitle: stage.subject?.title ?? null,
        encadreurName: stage.encadrantPro
          ? `${stage.encadrantPro.firstName} ${stage.encadrantPro.lastName}`
          : null,
        startDate: stage.startDate,
        endDate: stage.endDate,
        daysRemaining,
      };
    }

    // ── Jalons ──
    let jalonData = {
      total: 0,
      validated: 0,
      pending: 0,
      overdue: 0,
      completionPercentage: 0,
      nextDeadline: null as Date | null,
    };

    if (stage) {
      const jalons = await this.jalonRepo.find({
        where: { stageId: stage.id },
        order: { dueDate: 'ASC' },
      });

      const total = jalons.length;
      const validated = jalons.filter((j) => j.status === JalonStatus.VALIDATED).length;
      const pending = jalons.filter((j) => j.status === JalonStatus.PENDING).length;
      const overdue = jalons.filter(
        (j) =>
          new Date(j.dueDate) < now &&
          j.status !== JalonStatus.VALIDATED &&
          j.status !== JalonStatus.REJECTED,
      ).length;

      const nextUpcoming = jalons.find(
        (j) => new Date(j.dueDate) >= now && j.status !== JalonStatus.VALIDATED,
      );

      jalonData = {
        total,
        validated,
        pending,
        overdue,
        completionPercentage: total > 0 ? Math.round((validated / total) * 100) : 0,
        nextDeadline: nextUpcoming ? new Date(nextUpcoming.dueDate) : null,
      };
    }

    return {
      profile: profileData,
      candidatures: {
        total: totalCandidatures,
        pending: candPending,
        accepted: candAccepted,
        rejected: candRejected,
      },
      stage: stageData,
      jalons: jalonData,
      subjectSuggestionsAvailable: profile?.isAiProcessed ?? false,
    };
  }
}
