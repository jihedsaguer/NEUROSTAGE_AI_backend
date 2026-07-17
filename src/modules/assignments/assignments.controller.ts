import { Controller, Post, Get, Param, Put, Delete, Patch, Body, UseGuards } from "@nestjs/common";
import { AssignmentsService } from "./assignments.service";
import { AssignStudentDto } from "./dto/assign-student.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { SYSTEM_ROLES } from "../roles/constants/roles.constants";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assignments')
export class AssignmentsController {
    constructor(private readonly assignmentsService: AssignmentsService) {}

    @Post("assign")
    @Roles(SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ADMIN_FORMATION)
    assignEncadreurToStudent(@Body() dto: AssignStudentDto) {
        return this.assignmentsService.assignEncadreurToStudent(dto.encadreurId, dto.studentId);
    }
    @Get('encadreur/:id/students')
    @Roles(SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ADMIN_FORMATION, SYSTEM_ROLES.ENCADRANT_PRO)
    getStudentsofEncadreur(@Param('id') encadreurId: string) {
        return this.assignmentsService.getStudentsofEncadreur(encadreurId);
    }
    @Get('student/:id/encadreurs')
    @Roles(SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ADMIN_FORMATION, SYSTEM_ROLES.ENCADRANT_PRO, SYSTEM_ROLES.ENCADRANT_ACADEMIQUE, SYSTEM_ROLES.STUDENT)
    getEncadreursofStudent(@Param('id') studentId: string) {
        return this.assignmentsService.getEncadreursofStudent(studentId);
    }
    @Delete("delete")
    @Roles(SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ADMIN_FORMATION)
    removeAssignment(@Body() dto: AssignStudentDto) {
        return this.assignmentsService.removeAssignment(dto.encadreurId, dto.studentId);
    }

}
