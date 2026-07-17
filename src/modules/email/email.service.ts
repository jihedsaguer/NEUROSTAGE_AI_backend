
import { Injectable } from '@nestjs/common';
import { User } from '../users/entities/user.entity';
import { MailerService } from '@nestjs-modules/mailer';
@Injectable()
export class EmailService {

 constructor(
    private readonly mailerService: MailerService
  ) {}
  async sendVerificationEmail(user: User, token: string) {
    const backendUrl = process.env.BACKEND_URL || process.env.APP_URL || 'http://localhost:3000';
    const verificationLink = `${backendUrl.replace(/\/$/, '')}/email/verify?token=${encodeURIComponent(token)}`;

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