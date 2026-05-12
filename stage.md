# Frontend Prompt — Stages Module (NEUROSTAGE AI)

You are a senior React frontend engineer working on **NEUROSTAGE AI**, a production-grade internship management platform. Your task is to implement the complete **Stages** feature for the frontend, covering TypeScript types, Redux Toolkit state management, API layer, and all UI pages for both Admin and Student roles.

---

## 🧱 TECH STACK (already in place — do NOT change)

- React + TypeScript
- Redux Toolkit (RTK Query or createAsyncThunk — match existing pattern)
- React Router v6
- Tailwind CSS (or the existing UI library in the project)
- Axios (or fetch — match existing API client pattern)
- JWT stored in localStorage/cookie (match existing auth pattern)
- Role-based rendering already handled via auth context/store

---

## 📐 EXACT BACKEND CONTRACTS

### Base URL: `/stages`

### Types to implement (match exactly):

```typescript
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
  startDate: string | null;   // ISO date string
  endDate: string | null;     // ISO date string
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStagePayload {
  candidatureId: string;
  encadrantProId?: string;    // optional — defaults to subject.createdBy if they are encadrant_pro
  encadrantAcadId?: string;
  startDate?: string;         // ISO date string
  endDate?: string;           // ISO date string
  adminNotes?: string;
}

export interface UpdateStagePayload {
  status?: StageStatus;
  startDate?: string;
  endDate?: string;
  adminNotes?: string;
}

export interface AssignProPayload {
  encadrantProId: string;
}

export interface AssignAcadPayload {
  encadrantAcadId: string;
}
```

### API Endpoints:

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/stages` | ADMIN | Create stage from accepted candidature |
| GET | `/stages` | ADMIN | Get all stages |
| GET | `/stages/:id` | ALL (scoped) | Get stage by ID |
| PATCH | `/stages/:id` | ADMIN | Update stage metadata/status |
| PATCH | `/stages/:id/assign-pro` | ADMIN | Assign/reassign encadrant pro |
| PATCH | `/stages/:id/assign-acad` | ADMIN | Assign/reassign encadrant acad |
| PATCH | `/stages/:id/cancel` | ADMIN | Cancel a stage |
| GET | `/stages/my/stage` | STUDENT | Get own stage |
| GET | `/stages/my/as-pro` | ENCADRANT_PRO | Get supervised stages |
| GET | `/stages/my/as-acad` | ENCADRANT_ACAD | Get tutored stages |

---

## 🗂️ FILES TO CREATE

### 1. Types — `src/types/stage.types.ts`

Implement all types listed above. Also add:

```typescript
export interface StagesState {
  stages: Stage[];
  currentStage: Stage | null;
  loading: boolean;
  error: string | null;
}
```

---

### 2. API Layer — `src/api/stageApi.ts`

Use the existing axios instance (with JWT interceptor already configured). Implement:

```typescript
export const stageApi = {
  // Admin
  createStage: (payload: CreateStagePayload) => Promise<Stage>
  getAllStages: () => Promise<Stage[]>
  getStageById: (id: string) => Promise<Stage>
  updateStage: (id: string, payload: UpdateStagePayload) => Promise<Stage>
  assignPro: (id: string, payload: AssignProPayload) => Promise<Stage>
  assignAcad: (id: string, payload: AssignAcadPayload) => Promise<Stage>
  cancelStage: (id: string) => Promise<Stage>

  // Student
  getMyStage: () => Promise<Stage>

  // Encadrant Pro
  getMyStagesAsPro: () => Promise<Stage[]>

  // Encadrant Acad
  getMyStagesAsAcad: () => Promise<Stage[]>
}
```

---

### 3. Redux Slice — `src/store/slices/stagesSlice.ts`

Use `createAsyncThunk` + `createSlice`. Implement thunks for every API call above.

State shape:
```typescript
{
  stages: Stage[];          // admin list
  currentStage: Stage | null;  // student/encadrant single view
  selectedStage: Stage | null; // admin detail view
  loading: boolean;
  error: string | null;
}
```

Handle all three async states (`pending`, `fulfilled`, `rejected`) for each thunk.

Export all thunks and the reducer.

---

## 🖥️ PAGES TO BUILD

### ADMIN PAGES

---

#### `AdminStagesPage` — `/admin/stages`

**Purpose:** Full list of all stages with management actions.

**Layout:**
- Page title: "Gestion des Stages"
- Stats bar at top: total count, breakdown by status (PENDING_ACAD / ACTIVE / COMPLETED / CANCELLED) shown as colored badge counters
- Filter bar: filter by status (dropdown), search by student name or subject title (text input)
- Table with columns:
  - Student (firstName + lastName)
  - Subject (title)
  - Encadrant Pro (firstName + lastName, or "Non assigné" badge)
  - Encadrant Acad (firstName + lastName, or "En attente" badge in orange)
  - Status (colored badge: PENDING_ACAD=orange, ACTIVE=green, COMPLETED=blue, CANCELLED=red)
  - Start Date / End Date
  - Actions column: "Voir", "Modifier", "Annuler" buttons

**Behavior:**
- On mount: dispatch `fetchAllStages`
- "Voir" → navigate to `/admin/stages/:id`
- "Modifier" → open `EditStageModal`
- "Annuler" → confirmation dialog → dispatch `cancelStage`
- Show loading skeleton while fetching
- Show empty state if no stages

---

#### `AdminStageDetailPage` — `/admin/stages/:id`

**Purpose:** Full detail view of a single stage with all assignment controls.

**Layout:**
- Back button → `/admin/stages`
- Stage header card: subject title, status badge, dates
- Two-column grid:
  - Left: Student info card (name, email)
  - Right: Subject info card (title, level, technologies as tags)
- Supervisors section:
  - Encadrant Pro card: name + email + "Réassigner" button
  - Encadrant Acad card: name + email + "Réassigner" button (or "Assigner un encadrant académique" CTA if null — highlighted in orange since stage is PENDING_ACAD)
- Admin Notes section: textarea (editable inline, save on blur or explicit save button)
- Danger zone: "Annuler le stage" button (red, with confirmation modal)

**Modals needed:**
- `AssignProModal`: searchable dropdown of users with `encadrant_pro` role → submit calls `assignPro`
- `AssignAcadModal`: searchable dropdown of users with `encadrant_academique` role → submit calls `assignAcad`
- `EditStageModal`: form with status select, startDate, endDate, adminNotes → submit calls `updateStage`
- `CancelStageModal`: confirmation with warning text

**Behavior:**
- On mount: dispatch `fetchStageById(id)`
- After any mutation: re-fetch stage to reflect updated state
- Show toast notification on success/error

---

#### `AdminCreateStageModal` (or page `/admin/stages/create`)

**Purpose:** Promote an accepted candidature to a stage.

**Form fields:**
- `candidatureId` — searchable select showing accepted candidatures (id + student name + subject title)
- `encadrantProId` — optional searchable select of `encadrant_pro` users (with helper text: "Laissez vide pour utiliser le créateur du sujet")
- `encadrantAcadId` — optional searchable select of `encadrant_academique` users
- `startDate` — date picker
- `endDate` — date picker
- `adminNotes` — textarea

**Validation:**
- `candidatureId` required
- `endDate` must be after `startDate` if both provided

**Behavior:**
- On submit: dispatch `createStage` → on success close modal and refresh list

---

### STUDENT PAGES

---

#### `StudentStagePage` — `/student/stage`

**Purpose:** Student's single view of their internship.

**Layout:**
- Page title: "Mon Stage"
- If no stage: empty state card — "Votre stage n'a pas encore été créé. Votre candidature est en cours de traitement."
- If stage exists:
  - Status banner at top (color-coded, with human-readable label):
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
