import { Controller, Post,Get, Param, Put , Delete, Patch, Body  } from "@nestjs/common";
import { AssignmentsService } from "./assignments.service";
import { AssignStudentDto } from "./dto/assign-student.dto";

@Controller('assignments')
export class AssignmentsController {
    constructor(private readonly assignmentsService: AssignmentsService) {}

    @Post("assign")
    assignEncadreurToStudent(@Body() dto: AssignStudentDto) {
        return this.assignmentsService.assignEncadreurToStudent(dto.encadreurId, dto.studentId);
    }
    @Get('encadreur/:id/students')
    getStudentsofEncadreur(@Param('id') encadreurId: string) {
        return this.assignmentsService.getStudentsofEncadreur(encadreurId);
    }
    @Get('student/:id/encadreurs')
    getEncadreursofStudent(@Param('id') studentId: string) {
        return this.assignmentsService.getEncadreursofStudent(studentId);
    }
    @Delete("delete")
    removeAssignment(@Body() dto: AssignStudentDto) {
        return this.assignmentsService.removeAssignment(dto.encadreurId, dto.studentId);
    }

}
