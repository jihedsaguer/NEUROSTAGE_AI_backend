import { Controller, Get, Post, Body, HttpCode, HttpStatus, UseGuards, Query, Param, NotFoundException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  /**
   * GET /auth/verify-email?token=...
   * Called when the user clicks the verification link in their email.
   */
  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    await this.authService.verifyEmail(token);
    return { message: 'Email verified successfully. You can now log in.' };
  }

  /**
   * POST /auth/resend-verification
   * Allows a user to request a new verification email.
   */
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body('email') email: string) {
    await this.authService.resendVerificationEmail(email);
    return { message: 'Verification email sent.' };
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Body('userId') userId: string) {
    return this.authService.logout(userId);
  }

  /**
   * GET /auth/dev/verify/:email
   * DEV ONLY — manually verify an email address without SMTP.
   * Returns 404 in production.
   */
  @Get('dev/verify/:email')
  async devVerifyEmail(@Param('email') email: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }
    await this.authService.devVerifyEmail(email);
    return { message: `Email verified for ${email}` };
  }
}