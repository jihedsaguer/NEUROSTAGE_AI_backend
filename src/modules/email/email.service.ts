import { Injectable } from '@nestjs/common';
import { User } from '../users/entities/user.entity';
import { MailerService } from '@nestjs-modules/mailer';
@Injectable()
export class EmailService {
  constructor(private readonly mailerService: MailerService) {}
  async sendVerificationEmail(user: User, token: string) {
    // BACKEND_URL must include the /api prefix when behind Nginx.
    // Production: set BACKEND_URL=http://192.168.30.135/api in the server .env
    // Local dev:  set BACKEND_URL=http://localhost:3000  (NestJS directly, no prefix)
    const backendUrl = (process.env.BACKEND_URL || process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const verificationLink = `${backendUrl}/email/verify?token=${encodeURIComponent(token)}`;

    await this.mailerService.sendMail({
      to: user.email,
      subject: 'Verify Your Email',
      template: 'verify-email',
      context: {
        name: user.firstName,
        verificationLink,
      },
    });
  }
}
