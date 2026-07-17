# Frontend Prompt — Stages Module (NEUROSTAGE AI)

You are a senior React frontend engineer tasked with refining and completing the frontend Stages feature using the existing implementation as the foundation.

This prompt is an enhancement plan, not a full rebuild: leverage the current pages, components, and store logic already in place, and fill the proven gaps in UI, routing, and backend contract alignment.

---

## Objectives

- Align the Stages frontend with backend behavior and contracts using current app structure.
- Improve and complete existing role-based pages for Admin, Student, Encadrant Pro, and Encadrant Acad.
- Add or fix only the missing routing, navigation, and state logic required for a polished experience.
- Preserve and reuse existing components, pages, and data flows wherever possible.
- Avoid hardcoded data, duplicated logic, and any UI that contradicts backend roles or endpoints.

---

## Existing backend behavior to respect

The backend currently supports:
- Admin creation of stages from accepted candidatures
- Admin editing of stage metadata and status
- Admin assignment/reassignment of professional and academic supervisors
- Admin cancellation of stages
- Student retrieval of their own stage via `/stages/my/stage`
- Encadrant Pro retrieval of supervised stages via `/stages/my/as-pro`
- Encadrant Acad retrieval of tutored stages via `/stages/my/as-acad`

The frontend must faithfully map to these endpoints and not invent a parallel workflow.

---

## Core frontend requirements

### 1. Routing

Add dedicated routes for each role and avoid conflicts.

Required routes:
- `/admin/stages`
- `/admin/stages/create` or `/admin/stages/new`
- `/admin/stages/:id`
- `/student/stage`
- `/pro/stages`
- `/acad/stages`

Routing rules:
- Register `/student/stage`, `/pro/stages`, and `/acad/stages` before any generic `/stages/:id` route.
- Protect admin routes so only users with `ADMIN_FORMATION` or `SUPER_ADMIN` see them.
- Protect pro routes so only `ENCADRANT_PRO` users see them.
- Protect acad routes so only `ENCADRANT_ACADEMIQUE` users see them.
- Use existing auth state from the app; do not recreate role-check logic.

### 2. Navigation / Dashboard

Enhance platform navigation by adding stage-related links to the appropriate dashboards.

- Admin dashboard should include a "Stages" entry linking to `/admin/stages`.
- Student dashboard should include "Mon Stage" linking to `/student/stage`.
- Encadrant Pro dashboard should include "Mes Stages" linking to `/pro/stages`.
- Encadrant Acad dashboard should include "Mes Stages" linking to `/acad/stages`.

Ensure navigation is role-aware and does not surface irrelevant pages.

### 3. Page responsibilities

#### Admin pages

`/admin/stages`
- List all stages
- Filter by status and search by student/subject
- Display supervisor assignment states and stage dates
- Support actions: view detail, edit, cancel

`/admin/stages/:id`
- Show stage details, student info, subject info, supervisor info
- Allow reassigning encadrant pro and encadrant acad
- Allow updating status, dates, and admin notes
- Allow cancelling stage with confirmation

`/admin/stages/create`
- Promote an accepted candidature to a stage
- Allow optional explicit `encadrantProId` and `encadrantAcadId`
- Use backend candidature and user data; do not hardcode lists
- Validate date ranges and required fields

#### Student page

`/student/stage`
- Show the student’s current stage if it exists
- If not, render a soft empty state explaining that the stage is pending
- Use a status banner with French labels and colors
- Display subject details, encadrant pro information, and encadrant acad information
- Render read-only content only; no edit controls

#### Encadrant Pro page

`/pro/stages`
- List stages where current user is encadrant pro
- Show student name, subject title, status, and dates
- Provide a view-only detail or link to stage information
- Do not expose admin-only actions

#### Encadrant Acad page

`/acad/stages`
- List stages where current user is encadrant acad
- Show student name, subject title, status, and dates
- Provide a view-only detail or link to stage information
- Do not expose admin-only actions

### 4. UI expectations

Use existing project UI conventions and keep the interface polished.

- Prefer shadcn-style components if the project already uses them.
- Implement a reusable `StageBadge` component for status labels.
- Use cards, tables, modals, and forms that feel consistent with the platform.
- Use color-coded, accessible status visuals.
- Keep actions context-specific: admin actions on admin pages only.

### 5. State and data flow

Implement a centralized stage state slice or service consistent with the application.

Data should be fetched from backend endpoints, not simulated.

Key concepts:
- `stage` list for admin pages
- single `stage` object for student and detail pages
- separate list endpoints for pro and acad roles
- form payloads must match backend DTOs
- preserve existing auth token / jwt handling

### 6. Backend contracts and payloads

Use these contracts exactly for frontend typing.

```ts
export type StageStatus = 'PENDING_ACAD' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface StageUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface StageSubject {
  id: string;
  title: string;
  level: string;
  technologies: string[];
}

export interface Stage {
  id: string;
  status: StageStatus;
  candidatureId: string;
  subject: StageSubject;
  student: StageUser;
  encadrantPro: StageUser;
  encadrantAcad: StageUser | null;
  startDate: string | null;
  endDate: string | null;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStagePayload {
  candidatureId: string;
  encadrantProId?: string;
  encadrantAcadId?: string;
  startDate?: string;
  endDate?: string;
  adminNotes?: string;
}

export interface UpdateStagePayload {
  status?: StageStatus;
  startDate?: string;
  endDate?: string;
  adminNotes?: string;
}

export interface AssignProPayload { encadrantProId: string; }
export interface AssignAcadPayload { encadrantAcadId: string; }
```

### 7. Error handling and edge cases

- `encadrantAcad` may be `null`; render gracefully.
- Backend returns a single object for `/stages/my/stage`; do not treat it as an array.
- Do not rely on hardcoded role lists or user selections.
- If a stage already exists for a candidature, the frontend should show a clear error from the backend rather than silently failing.
- All mutation flows must refresh the relevant data after success.

### 8. Implementation guidance

- Keep the logic simple and aligned with backend roles.
- Avoid adding routes or pages that the backend does not support.
- Do not add fake student or pro dashboards beyond the required pages.
- Prefer reusable UI components over repeated markup.
- Keep the stage module isolated and modular so it can be extended later.

---

## Deliverables

Build the following in the frontend project:

- `src/types/stage.types.ts`
- `src/api/stageApi.ts`
- `src/store/slices/stagesSlice.ts`
- Admin pages: `/admin/stages`, `/admin/stages/create`, `/admin/stages/:id`
- Student page: `/student/stage`
- Encadrant Pro page: `/pro/stages`
- Encadrant Acad page: `/acad/stages`
- Reusable `StageBadge` component
- Role-aware dashboard links and routing guards

---

## Quality criteria for the prompt

- The implementation must not break existing backend logic.
- The frontend should mirror backend role restrictions and API contract exactly.
- The architecture should remain consistent with the existing app.
- The feature should feel production-ready: clear UX, accessible badges, loading and error states, and role-specific visibility.
- Keep the code clean, minimal, and easy to maintain.

    - PENDING_ACAD → orange — "En attente d'un encadrant académique"
    - ACTIVE → green — "Stage en cours"
    - COMPLETED → blue — "Stage terminé"
    - CANCELLED → red — "Stage annulé"
  - Subject card: title, level, technologies (tag chips)
  - Supervisors section:
    - Encadrant Pro card: avatar initials, name, email, "Envoyer un message" button (placeholder for chat)
    - Encadrant Acad card: same layout, or "Non encore assigné" placeholder if null
  - Internship dates: start → end with a simple progress bar if ACTIVE
  - Admin Notes section (read-only, only shown if adminNotes is not null)

**Behavior:**
- On mount: dispatch `fetchMyStage`
- Handle 404 gracefully (no stage yet) — show empty state, not error
- No edit actions — student is read-only on this page

---

## 🎨 STATUS BADGE COMPONENT

Create a reusable `StageBadge` component:

```typescript
// src/components/stages/StageBadge.tsx
// Props: status: StageStatus
// Renders a colored pill badge with French label:
// PENDING_ACAD → orange  → "En attente (Acad.)"
// ACTIVE       → green   → "Actif"
// COMPLETED    → blue    → "Terminé"
// CANCELLED    → red     → "Annulé"
```

---

## ⚠️ IMPORTANT CONSTRAINTS

- Do NOT hardcode user lists — fetch `encadrant_pro` and `encadrant_academique` users from the existing users API (filter by role)
- Do NOT expose admin actions to students — use role check from auth store before rendering
- All API errors must be caught and shown as toast notifications (use existing toast system)
- All date inputs must use ISO format (`YYYY-MM-DD`) when sending to API
- `encadrantAcad: null` is a valid state — render it gracefully everywhere, never crash on null
- The `GET /stages/my/stage` endpoint returns a single object, not an array — handle accordingly
- Route `/stages/my/stage` on the backend is a static path — ensure React Router defines `/my/stage` before `/:id` to avoid route conflicts

---

## 🔁 REDUX STORE INTEGRATION

Register the slice in the root store:

```typescript
// src/store/index.ts (add to existing reducers)
stages: stagesReducer
```

---

## ✅ DEFINITION OF DONE

- [ ] All TypeScript types defined with no `any`
- [ ] All API functions implemented and typed
- [ ] Redux slice handles all async states cleanly
- [ ] Admin can create, view, edit, assign supervisors, and cancel stages
- [ ] Student can view their stage with correct status messaging
- [ ] `StageBadge` component is reusable across all pages
- [ ] Empty states and loading states handled on every page
- [ ] No role leakage — admin UI not visible to students and vice versa
- [ ] All modals have proper open/close/loading/error states
