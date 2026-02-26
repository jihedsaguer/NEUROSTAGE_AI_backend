
import { Controller, Post, Get, Body, Query, Inject, forwardRef, Res, BadRequestException } from "@nestjs/common";
import { EmailService } from "./email.service";
import { AuthService } from "../auth/auth.service";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import type { Response } from 'express';

@Controller('email')
export class EmailController {
  constructor(
    private readonly emailService: EmailService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {}

  /**
   * GET /email/verify?token=XXX
   * Click the email verification link directly to auto-verify and redirect
   */
  @Get('verify')
  async verifyEmailViaLink(
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    if (!token) {
      throw new BadRequestException('Verification token is required');
    }

    try {
      await this.authService.verifyEmail(token);
      // Redirect to login with success flag
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/login?verified=true&message=Email%20verified!%20You%20can%20now%20login.`);
    } catch (error) {
      // Redirect with error message
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const errorMsg = encodeURIComponent(error.message || 'Verification failed');
      return res.redirect(`${frontendUrl}/login?error=${errorMsg}`);
    }
  }

  /**
   * POST /email/verify-email
   * For API clients (mobile, custom frontend) that send token in body
   */
  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.authService.verifyEmail(dto.token);
    return { success: true, message: 'Email verified successfully! You can now login.' };
  }

  @Post('resend-verification')
  async resendVerification(@Body('email') email: string) {
    await this.authService.resendVerificationEmail(email);
    return { success: true, message: `Verification email has been sent to ${email}` };
  }
}
