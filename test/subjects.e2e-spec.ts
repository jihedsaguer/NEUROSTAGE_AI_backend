import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { SubjectStatus } from './../src/modules/subjects/entities/subject.entity';
import { SYSTEM_ROLES } from './../src/roles/constants/roles.constants';

describe('Subjects Module (e2e)', () => {
  let app: INestApplication;

  // Mock JWT tokens for different roles
  const createMockJWT = (role: string) => {
    return `Bearer mock-jwt-${role}`;
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /subjects - List Subjects', () => {
    it('should return paginated subjects', () => {
      return request(app.getHttpServer())
        .get('/subjects')
        .query({ limit: 10, offset: 0 })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('limit', 10);
          expect(res.body).toHaveProperty('offset', 0);
          expect(res.body).toHaveProperty('pages');
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('should filter subjects by search term', () => {
      return request(app.getHttpServer())
        .get('/subjects')
        .query({ search: 'React', limit: 20 })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body.data.every((s: any) =>
            s.title.toLowerCase().includes('react') ||
            s.description.toLowerCase().includes('react'),
          )).toBe(true);
        });
    });

    it('should filter subjects by technologies', () => {
      return request(app.getHttpServer())
        .get('/subjects')
        .query({ technologies: ['React', 'Node.js'], limit: 20 })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
        });
    });

    it('should filter subjects by level', () => {
      return request(app.getHttpServer())
        .get('/subjects')
        .query({ level: 'Master', limit: 20 })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body.data.every((s: any) => s.level === 'Master')).toBe(
            true,
          );
        });
    });

    it('should enforce max limit of 100', () => {
      return request(app.getHttpServer())
        .get('/subjects')
        .query({ limit: 500 })
        .expect(200)
        .expect((res) => {
          expect(res.body.limit).toBe(100);
        });
    });

    it('should sort by title ascending', () => {
      return request(app.getHttpServer())
        .get('/subjects')
        .query({ sortBy: 'title', sortOrder: 'ASC', limit: 50 })
        .expect(200)
        .expect((res) => {
          if (res.body.data.length > 1) {
            for (let i = 0; i < res.body.data.length - 1; i++) {
              expect(
                res.body.data[i].title <= res.body.data[i + 1].title,
              ).toBe(true);
            }
          }
        });
    });

    it('should sort by createdAt descending', () => {
      return request(app.getHttpServer())
        .get('/subjects')
        .query({ sortBy: 'createdAt', sortOrder: 'DESC', limit: 50 })
        .expect(200)
        .expect((res) => {
          if (res.body.data.length > 1) {
            for (let i = 0; i < res.body.data.length - 1; i++) {
              expect(
                new Date(res.body.data[i].createdAt) >=
                  new Date(res.body.data[i + 1].createdAt),
              ).toBe(true);
            }
          }
        });
    });
  });

  describe('POST /subjects - Create Subject', () => {
    it('should create a subject with valid data', () => {
      const createSubjectDto = {
        title: 'Advanced TypeScript',
        description: 'Master TypeScript for enterprise applications',
        technologies: ['TypeScript', 'Node.js'],
        level: 'Master',
        prerequisites: 'JavaScript basics',
      };

      return request(app.getHttpServer())
        .post('/subjects')
        .send(createSubjectDto)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.title).toBe(createSubjectDto.title);
          expect(res.body.description).toBe(createSubjectDto.description);
          expect(res.body.technologies).toEqual(createSubjectDto.technologies);
          expect(res.body.level).toBe(createSubjectDto.level);
        });
    });

    it('should reject subject without title', () => {
      const invalidDto = {
        description: 'Missing title',
      };

      return request(app.getHttpServer())
        .post('/subjects')
        .send(invalidDto)
        .expect(400);
    });

    it('should reject subject with title exceeding 255 characters', () => {
      const invalidDto = {
        title: 'A'.repeat(256),
        description: 'Description',
      };

      return request(app.getHttpServer())
        .post('/subjects')
        .send(invalidDto)
        .expect(400);
    });

    it('should accept subject without technologies (optional)', () => {
      const createSubjectDto = {
        title: 'General Subject',
        description: 'A subject without specified technologies',
      };

      return request(app.getHttpServer())
        .post('/subjects')
        .send(createSubjectDto)
        .expect(201)
        .expect((res) => {
          expect(res.body.title).toBe(createSubjectDto.title);
        });
    });
  });

  describe('GET /subjects/:id - Get Single Subject', () => {
    it('should return a single subject by ID', () => {
      // First, create a subject
      const createDto = {
        title: 'Test Subject',
        description: 'For single retrieval',
      };

      return request(app.getHttpServer())
        .post('/subjects')
        .send(createDto)
        .then((createRes) => {
          // Then retrieve it
          return request(app.getHttpServer())
            .get(`/subjects/${createRes.body.id}`)
            .expect(200)
            .expect((res) => {
              expect(res.body.id).toBe(createRes.body.id);
              expect(res.body.title).toBe(createDto.title);
            });
        });
    });

    it('should return 404 for non-existent subject', () => {
      return request(app.getHttpServer())
        .get('/subjects/non-existent-id')
        .expect(404);
    });
  });

  describe('PUT /subjects/:id - Update Subject', () => {
    it('should update subject with valid data', () => {
      const createDto = {
        title: 'Original Title',
        description: 'Original Description',
      };

      const updateDto = {
        title: 'Updated Title',
        description: 'Updated Description',
      };

      return request(app.getHttpServer())
        .post('/subjects')
        .send(createDto)
        .then((createRes) => {
          return request(app.getHttpServer())
            .put(`/subjects/${createRes.body.id}`)
            .send(updateDto)
            .expect(200)
            .expect((res) => {
              expect(res.body.title).toBe(updateDto.title);
              expect(res.body.description).toBe(updateDto.description);
            });
        });
    });
  });

  describe('DELETE /subjects/:id - Delete Subject', () => {
    it('should delete subject', () => {
      const createDto = {
        title: 'Subject to Delete',
        description: 'Will be deleted',
      };

      return request(app.getHttpServer())
        .post('/subjects')
        .send(createDto)
        .then((createRes) => {
          return request(app.getHttpServer())
            .delete(`/subjects/${createRes.body.id}`)
            .expect(200)
            .expect((res) => {
              expect(res.body).toHaveProperty('message');
              expect(res.body.message).toContain('deleted successfully');
            });
        });
    });
  });

  describe('GET /subjects/my - Get My Subjects', () => {
    it('should return user\'s own subjects with pagination', () => {
      return request(app.getHttpServer())
        .get('/subjects/my')
        .query({ limit: 10, offset: 0 })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('limit', 10);
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('should support pagination on my subjects', () => {
      return request(app.getHttpServer())
        .get('/subjects/my')
        .query({ limit: 5, offset: 2 })
        .expect(200)
        .expect((res) => {
          expect(res.body.limit).toBe(5);
          expect(res.body.offset).toBe(2);
        });
    });
  });

  describe('GET /subjects/pending - Get Pending Subjects', () => {
    it('should return pending subjects (admin only)', () => {
      return request(app.getHttpServer())
        .get('/subjects/pending')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          // All returned subjects should be PENDING status
          expect(
            res.body.every((s: any) => s.status === SubjectStatus.PENDING),
          ).toBe(true);
        });
    });
  });

  describe('PATCH /subjects/:id/validate - Validate Subject', () => {
    it('should validate a pending subject to VALIDATED', () => {
      const createDto = {
        title: 'Subject to Validate',
        description: 'Pending validation',
      };

      return request(app.getHttpServer())
        .post('/subjects')
        .send(createDto)
        .then((createRes) => {
          // Assume created subject is in PENDING state for this test
          return request(app.getHttpServer())
            .patch(`/subjects/${createRes.body.id}/validate`)
            .send({ status: SubjectStatus.VALIDATED })
            .expect(200)
            .expect((res) => {
              expect(res.body.status).toBe(SubjectStatus.VALIDATED);
            });
        });
    });

    it('should reject a pending subject', () => {
      const createDto = {
        title: 'Subject to Reject',
        description: 'Will be rejected',
      };

      return request(app.getHttpServer())
        .post('/subjects')
        .send(createDto)
        .then((createRes) => {
          return request(app.getHttpServer())
            .patch(`/subjects/${createRes.body.id}/validate`)
            .send({ status: SubjectStatus.REJECTED })
            .expect(200)
            .expect((res) => {
              expect(res.body.status).toBe(SubjectStatus.REJECTED);
            });
        });
    });

    it('should reject invalid status', () => {
      const createDto = {
        title: 'Test Subject',
        description: 'Testing',
      };

      return request(app.getHttpServer())
        .post('/subjects')
        .send(createDto)
        .then((createRes) => {
          return request(app.getHttpServer())
            .patch(`/subjects/${createRes.body.id}/validate`)
            .send({ status: 'INVALID_STATUS' })
            .expect(400);
        });
    });
  });

  describe('Query Parameter Validation', () => {
    it('should validate limit parameter', () => {
      return request(app.getHttpServer())
        .get('/subjects')
        .query({ limit: -1 })
        .expect(400);
    });

    it('should validate offset parameter', () => {
      return request(app.getHttpServer())
        .get('/subjects')
        .query({ offset: -5 })
        .expect(400);
    });

    it('should handle invalid sortBy value', () => {
      return request(app.getHttpServer())
        .get('/subjects')
        .query({ sortBy: 'invalidField' })
        .expect(400);
    });

    it('should handle invalid sortOrder value', () => {
      return request(app.getHttpServer())
        .get('/subjects')
        .query({ sortOrder: 'INVALID' })
        .expect(400);
    });
  });
});
