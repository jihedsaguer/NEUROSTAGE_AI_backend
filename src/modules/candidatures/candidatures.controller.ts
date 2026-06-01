import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { CandidaturesService } from './candidatures.service';
import { CreateCandidatureDto, UpdateCandidatureDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SYSTEM_ROLES } from '../roles/constants/roles.constants';
import { ForbiddenException } from '@nestjs/common/exceptions/forbidden.exception';
@Controller('candidatures')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CandidaturesController {
  constructor(private readonly candidaturesService: CandidaturesService) {} 
    @Post()
    @Roles(SYSTEM_ROLES.STUDENT)
    async createCandidature(
        @Body() createCandidatureDto: CreateCandidatureDto,
        @Request() req,
    ) {
        return await this.candidaturesService.createCandidature(
            createCandidatureDto,
            req.user,
        );

}
    @Get('subject/:subjectId')
    async getBySubjectId(
        @Param('subjectId') subjectId: string,
        @Request() req,
    ) {
        return await this.candidaturesService.getBySubjectId(subjectId, req.user);
    }

    @Patch(':id/status')
    @Roles(SYSTEM_ROLES.ADMIN_FORMATION, SYSTEM_ROLES.SUPER_ADMIN)
    async updateStatus(
        @Param('id') id: string,
        @Body() updateCandidatureDto: UpdateCandidatureDto,
        @Request() req,
    ) {
        return await this.candidaturesService.updateStatus(id, updateCandidatureDto, req.user);
}

@Get('my-candidatures')
@Roles(SYSTEM_ROLES.STUDENT)
async findMyCandidatures(@Request() req) {
    return await this.candidaturesService.FindMyCandidatures(req.user);
}

@Delete(':id/cancel')
async cancelCandidature(
    @Param('id') id: string,
    @Request() req,
) {
    await this.candidaturesService.cancelCandidature(id, req.user);
    return { message: 'Candidature cancelled successfully' };
}
@Get()
@UseGuards(JwtAuthGuard)
async getAllCandidatures(@Request() req) {
const isAdmin = req.user.roles.some(role => 
        role.name === SYSTEM_ROLES.ADMIN_FORMATION || 
        role.name === SYSTEM_ROLES.SUPER_ADMIN
    );
    if(!isAdmin) {
        throw new ForbiddenException('You do not have access to this resource');
    }
    return await this.candidaturesService.GetAllCandidatures();
}
}
  