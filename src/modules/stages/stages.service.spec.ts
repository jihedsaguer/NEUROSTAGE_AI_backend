import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StagesService } from './stages.service';
import { Stage, StageStatus } from './entities/stage.entity';
import { Candidature, CandidatureStatus } from '../candidatures/entities/candidature.entity';
import { User } from '../users/entities/user.entity';
import { Subject } from '../subjects/entities/subject.entity';
import { SYSTEM_ROLES } from '../roles/constants/roles.constants';
import { CreateStageDto } from './dto';

describe('StagesService', () => {
  let service: StagesService;
  let stageRepository: jest.Mocked<Partial<Repository<Stage>>>;
  let candidatureRepository: jest.Mocked<Partial<Repository<Candidature>>>;
  let userRepository: jest.Mocked<Partial<Repository<User>>>;
  let subjectRepository: jest.Mocked<Partial<Repository<Subject>>>;

  const adminCreator: User = {
    id: 'admin-1',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    roles: [{ name: SYSTEM_ROLES.ADMIN_FORMATION }],
  } as unknown as User;

  const student: User = {
    id: 'student-1',
    email: 'student@example.com',
    firstName: 'Student',
    lastName: 'User',
    roles: [{ name: SYSTEM_ROLES.STUDENT }],
  } as unknown as User;

  const mockSubject: Subject = {
    id: 'subject-1',
    title: 'Subject Title',
    level: 'Master',
    technologies: ['Node.js'],
    createdBy: adminCreator,
  } as unknown as Subject;

  beforeEach(async () => {
    stageRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };

    candidatureRepository = {
      findOne: jest.fn(),
    };

    userRepository = {
      findOne: jest.fn(),
    };

    subjectRepository = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StagesService,
        {
          provide: getRepositoryToken(Stage),
          useValue: stageRepository,
        },
        {
          provide: getRepositoryToken(Candidature),
          useValue: candidatureRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
        {
          provide: getRepositoryToken(Subject),
          useValue: subjectRepository,
        },
      ],
    }).compile();

    service = module.get<StagesService>(StagesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should auto-create a stage when subject creator is admin_formation', async () => {
    const candidature: Partial<Candidature> = {
      id: 'cand-1',
      status: CandidatureStatus.ACCEPTED,
      student,
      subject: mockSubject,
    };

    const savedStage = {
      id: 'stage-1',
      candidatureId: candidature.id,
      student,
      subject: mockSubject,
      encadrantPro: adminCreator,
      encadrantProId: adminCreator.id,
      encadrantAcad: null,
      encadrantAcadId: null,
      status: StageStatus.PENDING_ACAD,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Stage;

    candidatureRepository.findOne!.mockResolvedValue(candidature as Candidature);
    stageRepository.findOne!.mockImplementation(({ where }) => {
      if ((where as any).candidatureId) {
        return Promise.resolve(null);
      }
      if ((where as any).id) {
        return Promise.resolve(savedStage);
      }
      return Promise.resolve(null);
    });
    stageRepository.create!.mockImplementation((input: any) => input);
    stageRepository.save!.mockResolvedValue(savedStage);

    const result = await service.createStage({ candidatureId: 'cand-1' });

    expect(stageRepository.save).toHaveBeenCalled();
    expect(result.encadrantPro.email).toBe('admin@example.com');
    expect(result.status).toBe(StageStatus.PENDING_ACAD);
  });

  it('should allow getStageById access for user with ADMIN_FORMATION among multiple roles', async () => {
    const stage = {
      id: 'stage-1',
      studentId: 'student-1',
      encadrantProId: 'admin-1',
      encadrantAcadId: null,
    } as unknown as Stage;

    stageRepository.findOne!.mockResolvedValue(stage);

    const multiRoleUser = {
      id: 'admin-1',
      roles: [
        { name: SYSTEM_ROLES.STUDENT },
        { name: SYSTEM_ROLES.ADMIN_FORMATION },
      ],
    } as unknown as User;

    const result = await service.getStageById('stage-1', multiRoleUser);
    expect(result.id).toBe('stage-1');
  });
});
