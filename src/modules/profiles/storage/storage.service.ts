/**
 * Environment (defaults):
 *   UPLOAD_DIR=./uploads
 *   UPLOAD_BASE_URL=http://localhost:3000/uploads
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { diskStorage } from 'multer';
import { createHash } from 'crypto';
import { createReadStream, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, extname, basename } from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Request } from 'express';

const DEFAULT_UPLOAD_DIR = './uploads';
const DEFAULT_UPLOAD_BASE_URL = 'http://localhost:3000/uploads';
const GLOBAL_MAX_FILE_SIZE = 10 * 1024 * 1024;

const MIME_EXTENSION_MAP: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    '.docx',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

export interface StoredFileMetadata {
  fileName: string;
  fileUrl: string;
  fileType: string;
  size: number;
  hash: string;
}

function resolveExtension(mimetype: string, originalname: string): string {
  const fromMime = MIME_EXTENSION_MAP[mimetype];
  if (fromMime) {
    return fromMime;
  }
  const ext = extname(originalname).toLowerCase();
  if (ext) {
    return ext;
  }
  return '';
}

/**
 * Shared Multer config for MulterModule.registerAsync (ConfigService context).
 */
export function createMulterOptions(configService: ConfigService): MulterOptions {
  const uploadDir =
    configService.get<string>('UPLOAD_DIR') ?? DEFAULT_UPLOAD_DIR;

  return {
    limits: { fileSize: GLOBAL_MAX_FILE_SIZE },
    storage: diskStorage({
      destination: (
        req: Request & { user?: { id: string } },
        _file,
        cb,
      ) => {
        const userId = req.user?.id;
        if (!userId) {
          return cb(new Error('Unauthorized: user not found on request'), '');
        }
        const dest = join(uploadDir, 'profiles', userId);
        try {
          mkdirSync(dest, { recursive: true });
          cb(null, dest);
        } catch (err) {
          cb(err as Error, dest);
        }
      },
      filename: (_req, file, cb) => {
        const ext = resolveExtension(file.mimetype, file.originalname);
        cb(null, `${uuidv4()}${ext}`);
      },
    }),
  };
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir: string;
  private readonly uploadBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.uploadDir =
      this.configService.get<string>('UPLOAD_DIR') ?? DEFAULT_UPLOAD_DIR;
    this.uploadBaseUrl =
      this.configService.get<string>('UPLOAD_BASE_URL') ??
      DEFAULT_UPLOAD_BASE_URL;
  }

  getMulterOptions(): MulterOptions {
    return createMulterOptions(this.configService);
  }

  buildPublicUrl(userId: string, storedFileName: string): string {
    const base = this.uploadBaseUrl.replace(/\/$/, '');
    return `${base}/profiles/${userId}/${storedFileName}`;
  }

  getFileMetadata(
    userId: string,
    file: Express.Multer.File,
    hash: string,
  ): StoredFileMetadata {
    const fileName = basename(file.filename);
    return {
      fileName,
      fileUrl: this.buildPublicUrl(userId, fileName),
      fileType: file.mimetype,
      size: file.size,
      hash,
    };
  }

  async computeFileHash(absolutePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(absolutePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  deleteFile(fileUrl: string): void {
    const absolutePath = this.resolveAbsolutePathFromUrl(fileUrl);
    if (!absolutePath) {
      this.logger.warn(`Could not resolve path for file URL: ${fileUrl}`);
      return;
    }
    this.deletePhysicalPath(absolutePath);
  }

  deletePhysicalPath(absolutePath: string): void {
    try {
      if (existsSync(absolutePath)) {
        unlinkSync(absolutePath);
      }
    } catch (err) {
      this.logger.warn(
        `Failed to delete file at ${absolutePath}: ${(err as Error).message}`,
      );
    }
  }

  private resolveAbsolutePathFromUrl(fileUrl: string): string | null {
    const base = this.uploadBaseUrl.replace(/\/$/, '');
    if (!fileUrl.startsWith(base)) {
      return null;
    }
    const relative = fileUrl.slice(base.length).replace(/^\//, '');
    return join(this.uploadDir, relative);
  }

}
