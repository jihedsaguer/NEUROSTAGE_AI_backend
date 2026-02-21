import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Assignment } from './entities/assignment.entity';
import { User } from '../users/entities/user.entity';
import { AssignmentResponseDto } from './dto/assignment-response.dto';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectRepository(Assignment)
    private assignmentRepository: Repository<Assignment>,

    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async assignEncadreurToStudent(encadreurId: string, studentId: string): Promise<AssignmentResponseDto> {
    const encadreur = await this.userRepository.findOne({ where: { id: encadreurId }, relations : ['roles']  });
    if (!encadreur) {
      throw new NotFoundException(`Encadreur with id ${encadreurId} not found`);
    }
// Check that user has encadreur role
  const isEncadreur = encadreur.roles.some(role => role.name.includes('encadreur'));
  if (!isEncadreur) throw new NotFoundException(`User with email ${encadreur.email} is not an encadreur`);
    const student = await this.userRepository.findOne({ where: { id: studentId } , relations : ['roles'] });
    if (!student) {
      throw new NotFoundException(`Student with id ${studentId} not found`);
    }

    const existingAssignment = await this.assignmentRepository.findOne({
      where: {
        encadreur: { id: encadreurId },
        student: { id: studentId },
      },
      relations: ['encadreur', 'student'],
    });

    if (existingAssignment) {
      throw new ConflictException('This student is already assigned to this encadreur');
    }

    const assignment = this.assignmentRepository.create({
      encadreur,
      student,
    });

    return plainToInstance(AssignmentResponseDto, await this.assignmentRepository.save(assignment), { 
      excludeExtraneousValues: true });
  }

  async getStudentsofEncadreur(encadreurId: string): Promise<User[]> {
    const assignments = await this.assignmentRepository.find({
        where: { encadreur: { id: encadreurId } },
        relations: ['student'],
    });
    return assignments.map(a => a.student);
  }

  async getEncadreursofStudent(studentId: string): Promise<User[]> {
    const assignments = await this.assignmentRepository.find({
        where: { student: { id: studentId } },
        relations: ['encadreur'],
    });
    return assignments.map(a => a.encadreur);
  }

  async removeAssignment(encadreurId: string, studentId: string): Promise<{ message: string }> {
    const assignment = await this.assignmentRepository.findOne({
      where: { encadreur: { id: encadreurId }, student: { id: studentId } },
    });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }
    await this.assignmentRepository.remove(assignment);
    return { message: 'Assignment removed successfully' };
    }
  } 
