import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';

// ENTITIES
import { User } from '../../modules/users/entities/user.entity';
import { Role } from '../../modules/roles/entities/role.entity';
import { StudentProfile } from '../../modules/profiles/entities/profiles.entity';
import { Subject } from '../../modules/subjects/entities/subject.entity';
import { Stage, StageStatus } from '../../modules/stages/entities/stage.entity';
import { ChatRoom, ChatRoomType } from '../../modules/chat/entities/chat-room.entity';
import { ChatParticipant } from '../../modules/chat/entities/chat-participant.entity';
import { ChatMessage, MessageType } from '../../modules/chat/entities/chat-message.entity';
import { Permission } from '../../modules/permissions/entities/permission.entity';
import { Candidature, CandidatureStatus } from '../../modules/candidatures/entities/candidature.entity';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'neuro_admin',
  password: 'neuro_password',
  database: 'neurostage_db',
  synchronize: true,
  logging: false,
  entities: [
    User,
    Role,
    StudentProfile,
    Subject,
    Permission,
    Candidature,
    Stage,
    ChatRoom,
    ChatParticipant,
    ChatMessage,
  ],
});

const safeInsert = async (
  repo: any,
  data: any[],
  uniqueField: string
) => {
  for (const item of data) {
    const exists = await repo.findOne({
      where: { [uniqueField]: item[uniqueField] },
    });

    if (!exists) {
      await repo.save(item);
    }
  }
};

async function seed() {
  await AppDataSource.initialize();
  console.log('🚀 Seeding database...');

  const roleRepo = AppDataSource.getRepository(Role);
  const userRepo = AppDataSource.getRepository(User);
  const profileRepo = AppDataSource.getRepository(StudentProfile);
  const subjectRepo = AppDataSource.getRepository(Subject);
  const stageRepo = AppDataSource.getRepository(Stage);
  const roomRepo = AppDataSource.getRepository(ChatRoom);
  const participantRepo = AppDataSource.getRepository(ChatParticipant);
  const messageRepo = AppDataSource.getRepository(ChatMessage);
  const candidatureRepo = AppDataSource.getRepository(Candidature);
  const permissionRepo = AppDataSource.getRepository(Permission);

  // ───────── ROLES (SAFE) ─────────
  await safeInsert(roleRepo, [
  { name: 'student' },
  { name: 'encadrant_pro' },
  { name: 'encadrant_acad' },
  { name: 'admin_formation' },
  { name: 'super_admin' },
], 'name');

  const roles = await roleRepo.find();
  const getRole = (name: string) => roles.find(r => r.name === name)!;

  // ───────── PERMISSIONS (SAFE) ─────────
 await safeInsert(permissionRepo, [
  // USERS
  { action: 'users.create' },
  { action: 'users.read' },
  { action: 'users.update' },
  { action: 'users.delete' },
  { action: 'users.manage_roles' },

  // SUBJECTS
  { action: 'subjects.create' },
  { action: 'subjects.read' },
  { action: 'subjects.update' },
  { action: 'subjects.delete' },
  { action: 'subjects.validate' },

  // CANDIDATURES
  { action: 'candidatures.create' },
  { action: 'candidatures.read' },
  { action: 'candidatures.update' },
  { action: 'candidatures.delete' },
  { action: 'candidatures.evaluate' },

  // STAGES
  { action: 'stages.create' },
  { action: 'stages.read' },
  { action: 'stages.update' },
  { action: 'stages.delete' },
  { action: 'stages.assign_encadrant' },

  // CHAT
  { action: 'chat.send' },
  { action: 'chat.read' },
  { action: 'chat.delete' },

  // DOCUMENTS
  { action: 'documents.generate' },
  { action: 'documents.read' },

  // AI
  { action: 'ai.matching.use' },
  { action: 'ai.rag.use' },

  // ADMIN
  { action: 'admin.settings.manage' },
], 'action');

  const admin = await userRepo.save({
    id: uuid(),
    email: 'admin@test.com',
    firstName: 'Admin',
    lastName: 'Formation',
    password: 'hashed',
    roles: [getRole('admin_formation')],
  });

  const encadrantPro = await userRepo.save({
    id: uuid(),
    email: 'pro@test.com',
    firstName: 'Encadrant',
    lastName: 'Pro',
    password: 'hashed',
    roles: [getRole('encadrant_pro')],
  });

  const encadrantAcad = await userRepo.save({
    id: uuid(),
    email: 'acad@test.com',
    firstName: 'Encadrant',
    lastName: 'Acad',
    password: 'hashed',
    roles: [getRole('encadrant_acad')],
  });

  const student = await userRepo.save({
    id: uuid(),
    email: 'student@test.com',
    firstName: 'Student',
    lastName: 'One',
    password: 'hashed',
    roles: [getRole('student')],
  });

  await profileRepo.save({
    id: uuid(),
    userId: student.id,
    phone: '12345678',
    university: 'ESPRIT',
    level: '5eme',
    skills: ['React', 'NestJS', 'PostgreSQL'],
    completionPercentage: 80,
  });

  const subject = await subjectRepo.save({
    id: uuid(),
    title: 'Plateforme IA de stages',
    description: 'Matching + Chat + OCR + RAG',
    technologies: ['NestJS', 'React'],
    level: 'Advanced',
    isValidated: true,
    createdById: admin.id,
  });

  const candidature = await candidatureRepo.save({
    id: uuid(),
    userId: student.id,
    subjectId: subject.id,
    status: CandidatureStatus.ACCEPTED,
    scoreMatch: 92,
    commentaires: 'Auto-approved seed',
  });

  const stage = await stageRepo.save(stageRepo.create({
    candidatureId: candidature.id,
    subjectId: subject.id,
    studentId: student.id,
    encadrantProId: encadrantPro.id,
    encadrantAcadId: encadrantAcad.id,
    status: StageStatus.ACTIVE,
  }));

  const room = await roomRepo.save({
    id: uuid(),
    name: `Stage - ${subject.title}`,
    type: ChatRoomType.STAGE,
    stageId: stage.id,
    isActive: true,
  });

  await participantRepo.save([
    { id: uuid(), roomId: room.id, userId: student.id },
    { id: uuid(), roomId: room.id, userId: encadrantPro.id },
    { id: uuid(), roomId: room.id, userId: encadrantAcad.id },
  ]);

  await messageRepo.save([
    {
      id: uuid(),
      roomId: room.id,
      senderId: student.id,
      content: 'Bonjour',
      type: MessageType.TEXT,
      isDeleted: false,
    },
  ]);

  console.log('✅ Seed completed successfully!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});