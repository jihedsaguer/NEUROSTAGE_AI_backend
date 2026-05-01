import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SubjectsService } from './subjects.service';
import { Subject, SubjectStatus } from './entities/subject.entity';
import { SYSTEM_ROLES } from '../roles/constants/roles.constants';
import { PaginatedResponseDto } from '../common/dto';
import { QuerySubjectsFilterDto, SortField, SortOrder } from './dto';

describe('SubjectsService', () => {
  let service: SubjectsService;
  let mockRepository: any;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    isActive: true,
    roles: [{ name: SYSTEM_ROLES.ENCADRANT_PRO }],
  };

  const mockAdminUser = {
    id: 'admin-1',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    isActive: true,
    roles: [{ name: SYSTEM_ROLES.SUPER_ADMIN }],
  };

  const mockStudentUser = {
    id: 'student-1',
    email: 'student@example.com',
    firstName: 'Student',
    lastName: 'User',
    isActive: true,
    roles: [{ name: SYSTEM_ROLES.STUDENT }],
  };

  const mockSubject = {
    id: 'subject-1',
    title: 'React Development',
    description: 'Learn React fundamentals',
    technologies: ['React', 'JavaScript'],
    level: 'Licence',
    prerequisites: 'JavaScript basics',
    status: SubjectStatus.VALIDATED,
    createdBy: mockUser,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubjectsService,
        {
          provide: getRepositoryToken(Subject),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<SubjectsService>(SubjectsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSubject', () => {
    it('should create a DRAFT subject for ENCADRANT_PRO', async () => {
      const createDto = {
        title: 'New Subject',
        description: 'Description',
      };

      const savedSubject = {
        ...mockSubject,
        status: SubjectStatus.DRAFT,
        createdBy: mockUser,
      };

      mockRepository.create.mockReturnValue(savedSubject);
      mockRepository.save.mockResolvedValue(savedSubject);
      mockRepository.findOne.mockResolvedValue(savedSubject);

      const result = await service.createSubject(createDto, mockUser);

      expect(result.status).toBe(SubjectStatus.DRAFT);
      expect(mockRepository.create).toHaveBeenCalledWith({
        ...createDto,
        status: SubjectStatus.DRAFT,
        createdBy: mockUser,
      });
    });

    it('should create a PENDING subject for STUDENT', async () => {
      const createDto = {
        title: 'Student Subject',
        description: 'Student Proposal',
      };

      const savedSubject = {
        ...mockSubject,
        status: SubjectStatus.PENDING,
        createdBy: mockStudentUser,
      };

      mockRepository.create.mockReturnValue(savedSubject);
      mockRepository.save.mockResolvedValue(savedSubject);
      mockRepository.findOne.mockResolvedValue(savedSubject);

      const result = await service.createSubject(createDto, mockStudentUser);

      expect(result.status).toBe(SubjectStatus.PENDING);
    });

    it('should create a VALIDATED subject for SUPER_ADMIN', async () => {
      const createDto = {
        title: 'Admin Subject',
        description: 'Admin Created',
      };

      const savedSubject = {
        ...mockSubject,
        status: SubjectStatus.VALIDATED,
        createdBy: mockAdminUser,
      };

      mockRepository.create.mockReturnValue(savedSubject);
      mockRepository.save.mockResolvedValue(savedSubject);
      mockRepository.findOne.mockResolvedValue(savedSubject);

      const result = await service.createSubject(createDto, mockAdminUser);

      expect(result.status).toBe(SubjectStatus.VALIDATED);
    });

    it('should throw ForbiddenException if user is inactive', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      const createDto = {
        title: 'Test',
        description: 'Description',
      };

      await expect(
        service.createSubject(createDto, inactiveUser),
      ).rejects.toThrow('User account is inactive');
    });
  });

  describe('getAllSubjects', () => {
    it('should return paginated subjects for ENCADRANT_PRO', async () => {
      const filter = new QuerySubjectsFilterDto();
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(25),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockSubject, mockSubject]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getAllSubjects(mockUser, filter);

      expect(result).toBeInstanceOf(PaginatedResponseDto);
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(25);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
      expect(result.pages).toBe(2);
    });

    it('should filter subjects by search term', async () => {
      const filter = new QuerySubjectsFilterDto();
      filter.search = 'React';

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(5),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockSubject]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getAllSubjects(mockUser, filter);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(subject.title ILIKE :search OR subject.description ILIKE :search)',
        { search: '%React%' },
      );
    });

    it('should filter subjects by technologies', async () => {
      const filter = new QuerySubjectsFilterDto();
      filter.technologies = ['React', 'Node.js'];

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(10),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockSubject]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getAllSubjects(mockUser, filter);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'subject.technologies && :technologies',
        { technologies: ['React', 'Node.js'] },
      );
    });

    it('should enforce max limit of 100', async () => {
      const filter = new QuerySubjectsFilterDto();
      filter.limit = 500; // Request more than max

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(200),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockSubject]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getAllSubjects(mockUser, filter);

      expect(result.limit).toBe(100); // Should be capped at 100
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(100);
    });

    it('should apply role-based visibility for STUDENT', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(5),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockSubject]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getAllSubjects(mockStudentUser, new QuerySubjectsFilterDto());

      // Should have called andWhere for VALIDATED status
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'subject.status = :status',
        { status: SubjectStatus.VALIDATED },
      );
    });

    it('should sort by title when requested', async () => {
      const filter = new QuerySubjectsFilterDto();
      filter.sortBy = SortField.TITLE;
      filter.sortOrder = SortOrder.ASC;

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(5),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockSubject]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getAllSubjects(mockUser, filter);

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('subject.title', 'ASC');
    });

    it('should apply pagination correctly', async () => {
      const filter = new QuerySubjectsFilterDto();
      filter.limit = 10;
      filter.offset = 20;

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(100),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockSubject]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getAllSubjects(mockUser, filter);

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(20);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(result.offset).toBe(20);
      expect(result.limit).toBe(10);
    });
  });

  describe('getMySubjects', () => {
    it('should return user\'s subjects with pagination', async () => {
      const filter = new QuerySubjectsFilterDto();

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(3),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockSubject]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getMySubjects(mockUser, filter);

      expect(result).toBeInstanceOf(PaginatedResponseDto);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'subject.createdBy.id = :userId',
        { userId: mockUser.id },
      );
    });
  });

  describe('validateSubject', () => {
    it('should validate a subject', async () => {
      const pendingSubject = {
        ...mockSubject,
        status: SubjectStatus.PENDING,
      };

      mockRepository.findOne.mockResolvedValue(pendingSubject);
      mockRepository.save.mockResolvedValue({
        ...pendingSubject,
        status: SubjectStatus.VALIDATED,
      });

      const result = await service.validateSubject('subject-1', {
        status: SubjectStatus.VALIDATED,
      });

      expect(result.status).toBe(SubjectStatus.VALIDATED);
    });

    it('should reject a subject', async () => {
      const pendingSubject = {
        ...mockSubject,
        status: SubjectStatus.PENDING,
      };

      mockRepository.findOne.mockResolvedValue(pendingSubject);
      mockRepository.save.mockResolvedValue({
        ...pendingSubject,
        status: SubjectStatus.REJECTED,
      });

      const result = await service.validateSubject('subject-1', {
        status: SubjectStatus.REJECTED,
      });

      expect(result.status).toBe(SubjectStatus.REJECTED);
    });
  });
});
