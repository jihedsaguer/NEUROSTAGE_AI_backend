import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createMulterOptions } from './storage.service';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

// Helper: invoke the fileFilter and resolve to true (accepted) or the thrown error
function runFilter(
  options: MulterOptions,
  mimetype: string,
  originalname: string,
): Promise<true | BadRequestException> {
  return new Promise((resolve) => {
    const file = { mimetype, originalname } as Express.Multer.File;
    (options.fileFilter as Function)({}, file, (err: unknown, accept: boolean) => {
      if (err) resolve(err as BadRequestException);
      else resolve(accept as unknown as true);
    });
  });
}

describe('StorageService — createMulterOptions fileFilter', () => {
  let options: MulterOptions;

  beforeEach(() => {
    const configService = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    options = createMulterOptions(configService);
  });

  // ── Allowed combinations ──────────────────────────────────────────────────

  it.each([
    ['application/pdf', 'document.pdf'],
    ['application/msword', 'report.doc'],
    [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'report.docx',
    ],
    ['image/jpeg', 'photo.jpg'],
    ['image/jpeg', 'photo.jpeg'],
    ['image/png', 'image.png'],
  ])('accepts %s / %s', async (mimetype, originalname) => {
    const result = await runFilter(options, mimetype, originalname);
    expect(result).toBe(true);
  });

  // ── Blocked extensions ────────────────────────────────────────────────────

  it.each([
    ['application/octet-stream', 'malware.exe'],
    ['application/x-php', 'shell.php'],
    ['application/javascript', 'payload.js'],
    ['text/html', 'xss.html'],
    ['image/svg+xml', 'xss.svg'],
    ['application/x-sh', 'exploit.sh'],
  ])('rejects blocked extension: %s / %s', async (mimetype, originalname) => {
    const result = await runFilter(options, mimetype, originalname);
    expect(result).toBeInstanceOf(BadRequestException);
    expect((result as BadRequestException).message).toMatch(/Invalid file extension/);
  });

  // ── MIME / extension mismatch (polyglot attack) ───────────────────────────

  it('rejects malicious.html disguised as application/pdf', async () => {
    const result = await runFilter(options, 'application/pdf', 'malicious.html');
    expect(result).toBeInstanceOf(BadRequestException);
    expect((result as BadRequestException).message).toMatch(/Invalid file extension/);
  });

  it('rejects .pdf extension with text/html MIME type', async () => {
    const result = await runFilter(options, 'text/html', 'document.pdf');
    expect(result).toBeInstanceOf(BadRequestException);
    expect((result as BadRequestException).message).toMatch(/Unsupported MIME type/);
  });

  it('rejects .jpg extension with application/pdf MIME type', async () => {
    const result = await runFilter(options, 'application/pdf', 'photo.jpg');
    expect(result).toBeInstanceOf(BadRequestException);
    expect((result as BadRequestException).message).toMatch(/does not match MIME type/);
  });

  it('rejects unknown MIME type with allowed extension', async () => {
    const result = await runFilter(options, 'application/x-unknown', 'file.pdf');
    expect(result).toBeInstanceOf(BadRequestException);
    expect((result as BadRequestException).message).toMatch(/Unsupported MIME type/);
  });
});
