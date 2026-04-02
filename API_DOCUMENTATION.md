# NEUROSTAGE AI Backend API Documentation

This document is intended for the frontend developer who will consume the backend endpoints. It describes each route, the logic behind it, the request/response shapes, and how the different modules interrelate. Use [Postman](https://www.postman.com/) or similar tools for testing. All endpoints are prefixed by the base URL (e.g. `http://localhost:3000`).

---

## 1. Authentication (`/auth`)

Handles user registration, login, token refresh, and logout. Every request that requires authentication expects a JWT `Authorization: Bearer <token>` header (except register/login).

### 1.1 Register
- **URL:** `POST /auth/register`
- **Body:** `RegisterDto`
  ```json
  {
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "password": "secret123"
  }
  ```
- **Logic:** Creates a new user record, hashes password, generates email verification token, sends verification email (via Email module).
- **Response:** `AuthResponseDto` object with newly created `user` and tokens. Access and refresh tokens are issued immediately but user is typically marked inactive until email verification.
- **Notes:** Email must be unique; class-validator enforces format and minimum lengths.

### 1.2 Login
- **URL:** `POST /auth/login`
- **Body:** `LoginDto`
  ```json
  {
    "email": "user@example.com",
    "password": "secret123"
  }
  ```
- **Logic:** Validates credentials; if successful returns `AuthResponseDto` with access/refresh tokens. Refresh token is stored server‑side (e.g., Redis or database) for later invalidation.
- **Response:** `AuthResponseDto` with `user` (including roles) and tokens.
- **HTTP Code:** 200 OK (explicit via `@HttpCode(HttpStatus.OK)`).

### 1.3 Refresh Token
- **URL:** `POST /auth/refresh`
- **Body:** `{ "refreshToken": "<token>" }`
- **Logic:** Verifies the provided refresh token, issues a new access token (and possibly a new refresh token).
- **Response:** new tokens or error if token is invalid/expired.

### 1.4 Logout
- **URL:** `POST /auth/logout`
- **Body:** `{ "userId": "<id>" }`
- **Logic:** Deletes/invalidates any stored refresh token for the given user. Frontend should also drop tokens locally.
- **Response:** success message (HTTP 200).

---

## 2. Users (`/users`)

CRUD operations for user profiles. The service likely enforces permission checks (not shown here) and returns `UserResponseDto` populated via class-transformer.

| Method | Path | Description | Body/Params |
|--------|------|-------------|-------------|
| POST | `/users/create` | Create a new user manually (admin) | `CreateUserDto` (email, names, password, roles?) |
| GET | `/users` | Get all users | — |
| GET | `/users/:id` | Get single user by id | `:id` path param |
| PATCH | `/users/:id` | Update user data | `UpdateUserDto` (optional fields) |
| DELETE | `/users/:id` | Remove user | `:id` path param |

### Data Shapes
- **CreateUserDto:** likely similar to `RegisterDto` with optional roles array.
- **UpdateUserDto:** fields that can be changed (first/last names, isActive, roles).

### Logic & Relationships
- At registration/login the authenticated user data returned by auth endpoints also uses this same user service internally to fetch/transform user data, including roles.
- Role relationships (a user has many roles; see `roles` property in `UserResponseDto`).

---

## 3. Roles (`/roles`)

Manage application roles. Roles can have permissions attached.

| Method | Path | Description | Body/Params |
|--------|------|-------------|-------------|
| POST | `/roles` | Create role | `CreateRoleDto` (name, maybe description) |
| GET | `/roles` | List all roles | — |
| GET | `/roles/:id` | Get single role | `:id` param |
| PUT | `/roles/:id` | Update role | `UpdateRoleDto` |
| DELETE | `/roles/:id` | Delete role | `:id` param |
| POST | `/roles/:id/permissions` | Add permissions to role | `{ permissionIds: string[] }` body |

### Logic
- The `addPermissions` endpoint accepts an array of permission IDs and associates them with the specified role. This is used by the frontend to build role-permission management UI.
- Roles are referenced by users (`UserResponseDto.roles`).
- Permissions attached to roles control access via guards (see `permissions.guard.ts` and `roles.guard.ts`).

---

## 4. Permissions (`/permissions`)

Define actions/resources that can be restricted. CRUD endpoints only; association is done via roles.

| Method | Path | Description | Body/Params |
|--------|------|-------------|-------------|
| POST | `/permissions` | Create permission | `CreatePermissionDto` (name, description) |
| GET | `/permissions` | List all permissions | — |
| GET | `/permissions/:id` | Get one permission | `:id` param |
| PUT | `/permissions/:id` | Update permission | `UpdatePermissionDto` |
| DELETE | `/permissions/:id` | Remove permission | `:id` param |

### Notes
- Permissions are typically strings like `create:user` or `assign:student` used by guards to authorize routes.
- The frontend should request the list of all permissions in order to present checkboxes when creating/editing roles.

---

## 5. Email Verification (`/email`)

Endpoints for verifying user email addresses after registration.

### 5.1 Click‑through Verification
- **URL:** `GET /email/verify?token=<token>`
- **Behavior:** This route is meant to be hit via a link in an email. It calls `AuthService.verifyEmail`, then redirects the browser back to frontend login page with query parameters indicating success or error. No JSON response is returned.

### 5.2 API Verification
- **URL:** `POST /email/verify-email`
- **Body:** `VerifyEmailDto` with `{ token: string }`.
- **Response:** JSON `{ success: true, message: '...' }` on success.

### 5.3 Resend Verification Link
- **URL:** `POST /email/resend-verification`
- **Body:** `{ email: string }`.
- **Response:** JSON success message.

### Logic & Flow
- After registration, the backend generates a verification token and sends the link via email. The link triggers frontend redirection logic with styling.
- The API route is present for mobile/SPA clients that handle the verification token internally instead of via browser redirect.

---

## 6. Assignments (`/assignments`)

Domain-specific module dealing with encadreurs and students (mentors/mentees).

| Method | Path | Description | Body/Params |
|--------|------|-------------|-------------|
| POST | `/assignments/assign` | Assign a student to an encadreur | `AssignStudentDto` `{ encadreurId, studentId }` |
| GET | `/assignments/encadreur/:id/students` | List students assigned to an encadreur | path `id` |
| GET | `/assignments/student/:id/encadreurs` | List encadreurs of a student | path `id` |
| DELETE | `/assignments/delete` | Remove assignment | `AssignStudentDto` in body |

### Logic
- This module establishes many‑to‑many relationships between two user types (`encadreur` and `student`). The service handles database joins and business rules.
- DTOs (`assignment-response.dto.ts`, etc.) define the shape of returned assignment info which can include nested student/encadreur details.
- Frontend will call `assign` action when an admin links a student and encadreur, use the GET endpoints to display associations, and call DELETE to unassign.

---

## 7. Security & Guards

The backend uses NestJS guards to enforce authorization. Relevant decorators live under `auth/guards`:
- `JwtAuthGuard` ensures a valid JWT is present.
- `RolesGuard` and `PermissionsGuard` inspect the current user's roles/permissions.
- Controllers may use custom decorators (`@Roles(...)` and `@Permissions(...)`) to declare required privileges.

**Frontend reminder:** Always send the access token in the `Authorization` header for protected routes, and handle 401/403 responses (redirect to login or show error). Refresh tokens are used to obtain new access tokens when expired.

---

## 8. Entities & Data Models

The `entities` directories contain TypeORM (or similar) models. Key relations:
- `User` has `roles` (many‑to‑many).
- `Role` has `permissions` (many‑to‑many).
- Assignments link `User` (as `encadreur`) and `User` (as `student`) or separate entities.

While the frontend doesn't need the full schema, understanding that `user.roles[i].permissions` can be iterated for client-side permission checks may be helpful.

---

## 9. Error Handling

Most controllers simply return values from service methods; errors are thrown as exceptions within NestJS services and will be transformed into HTTP responses by the global exception filter. Common status codes:
- `400 Bad Request` – validation errors, missing parameters.
- `401 Unauthorized` – invalid/missing JWT.
- `403 Forbidden` – lack of permissions.
- `404 Not Found` – resources not found (e.g. invalid id).
- `500 Internal Server Error` – unhandled exceptions.

Frontends should display error messages returned in JSON: `{ statusCode, message, error }`.

---

## 10. Frontend Integration Tips

1. **Authentication Flow**
   - On register, store the access & refresh tokens and redirect to verification prompt.
   - After login, save tokens to secure storage (httpOnly cookies or secure localStorage).
   - Automatically attach `Authorization` header.
   - Implement a refresh-token mechanism: when access token expires (401), call `/auth/refresh` then retry original request.

2. **Permissions & Roles**
   - After login, you receive `user.roles`. Each `RoleDto` may contain `id` and `name` (plus permissions exists if service returns them).
   - Use this data to configure client-side route guards, menu visibility, or button enable/disable logic.

3. **Email Verification**
   - If users click the link in their email, they’ll be redirected back to your frontend with query parameters. The frontend should display an appropriate message.
   - You may also implement a component that posts the token to `/email/verify-email` for AJAX flows.

4. **Entity Lists**
   - Permissions list: GET `/permissions` for populating forms.
   - Roles list: GET `/roles` when assigning roles to users.
   - Users list: GET `/users` for administration panels.

5. **Assignment Module**
   - When assigning or unassigning, ensure the frontend updates its state to reflect new associations. Use the GET endpoints to refresh lists.

6. **Environment Variables**
   - Backend uses `FRONTEND_URL` to redirect after email verification. Make sure it matches the deployed frontend address.

---

This document should give the frontend developer a clear map of available HTTP endpoints, the data they consume/produce, and how the different modules interact. Frontend implementation should follow REST conventions and handle authentication and error cases as outlined above.

Good luck building the React logic 🚀
