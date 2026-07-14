import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { mkdirSync } from 'fs';
import { join, extname, basename } from 'path';
import { diskStorage } from 'multer';
import { RagService } from './rag.service';
import { RagIngestDto, RagQueryDto } from './dto/rag.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SYSTEM_ROLES } from '../roles/constants/roles.constants';

@Controller('rag')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RagController {
  constructor(private readonly ragService: RagService) {}

  /**
   * POST /rag/documents
   * Admin formation only — ingest a procedure document into the RAG knowledge base.
   * The filePath must be the physical path on the shared Docker volume.
   */
  @Post('documents')
  @Roles(SYSTEM_ROLES.ADMIN_FORMATION, SYSTEM_ROLES.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async ingestDocument(@Body() dto: RagIngestDto) {
    return this.ragService.ingestDocument(
      dto.filePath,
      dto.documentName,
      dto.documentType,
    );
  }

  @Post('documents/upload')
  @Roles(SYSTEM_ROLES.ADMIN_FORMATION, SYSTEM_ROLES.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const uploadDir = process.env.UPLOAD_DIR ?? './uploads';
          const dest = join(uploadDir, 'rag');
          mkdirSync(dest, { recursive: true });
          cb(null, dest);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          const safeName = basename(file.originalname, ext)
            .replace(/[^a-zA-Z0-9._-]+/g, '_')
            .slice(0, 80);
          cb(null, `${Date.now()}-${safeName}${ext || '.pdf'}`);
        },
      }),
    }),
  )
  async uploadAndIngestDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body('documentName') documentName: string,
    @Body('documentType') documentType: string,
  ) {
    if (!file) {
      throw new BadRequestException('A file is required');
    }

    return this.ragService.ingestDocument(
      file.path,
      documentName || file.originalname,
      documentType || 'document',
    );
  }

  /**
   * POST /rag/query
   * All authenticated roles — ask a question about internship procedures.
   * encadrant_academique can use this (their only AI feature).
   */
  @Post('query')
  @Roles(
    SYSTEM_ROLES.STUDENT,
    SYSTEM_ROLES.ENCADRANT_PRO,
    SYSTEM_ROLES.ENCADRANT_ACADEMIQUE,
    SYSTEM_ROLES.ADMIN_FORMATION,
    SYSTEM_ROLES.SUPER_ADMIN,
  )
  @HttpCode(HttpStatus.OK)
  async query(@Body() dto: RagQueryDto, @Request() req) {
    return this.ragService.queryRag(dto.question, req.user.id);
  }
}
