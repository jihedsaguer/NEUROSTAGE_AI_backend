export interface JwtPayload {
  sub: string;
  email: string;
  /** All role names assigned to the user — used for WebSocket auth where no DB re-fetch occurs */
  roles: string[];
  permissions: string[];
}