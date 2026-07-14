import { Controller, Post, Param, Headers, UnauthorizedException } from '@nestjs/common';
import { ProfilesService } from './profiles.service';

/**
 * Internal callback controller — NO JwtAuthGuard.
 * Called by the FastAPI AI service to signal that CV processing is complete.
 * Secured by X-Internal-Secret header checked against INTERNAL_SECRET env var.
 */
@Controller('internal/profiles')
export class InternalProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Post(':userId/ai-processed')
  async markAiProcessed(
    @Param('userId') userId: string,
    @Headers('x-internal-secret') internalSecret?: string,
  ) {
    const expected = process.env.INTERNAL_SECRET;

    if (!expected || !internalSecret || internalSecret !== expected) {
      throw new UnauthorizedException('Invalid or missing internal secret');
    }

    await this.profilesService.markAiProcessed(userId);
    return { success: true };
  }
}
