import { Request } from 'express';
import { User } from '../../modules/users/entities/user.entity';

/**
 * Typed HTTP request after JwtAuthGuard has run.
 * Use this instead of `@Request() req: any` in controllers and the WebSocket gateway.
 *
 * Example:
 *   @Get('me')
 *   getMe(@Request() req: AuthenticatedRequest) {
 *     return req.user.id;
 *   }
 */
export interface AuthenticatedRequest extends Request {
  user: User & {
    /** All role names for this user — safe to use in WebSocket auth too */
    permissions: string[];
  };
}
