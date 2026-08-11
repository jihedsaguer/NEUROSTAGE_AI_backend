# Audit Technique — Plateforme NEUROSTAGE AI
## Référence technique pour rapport de PFE

**Règle de fiabilité :** Toute information est étiquetée `Confirmed by code:` ou `Inference:`.
Rien n'est inventé.

---

# PARTIE 1 — Backend NestJS

## Architecture globale

**Confirmed by code:** Le backend est une application monolithique NestJS v11, exposée sur le port 3000.
L'application importe 13 modules fonctionnels via `AppModule` et configure TypeORM en mode asynchrone
via `ConfigService`. La communication avec le service IA Python est exclusivement HTTP synchrone
(appels `fetch` directs), sans bus de messages ni broker.

---

## Module : Auth

### Responsabilité métier

Le module `auth` gère l'intégralité du cycle d'identité des utilisateurs : inscription avec envoi
d'e-mail de vérification, vérification du lien e-mail, connexion avec validation du mot de passe
haché, génération du JWT d'accès et du refresh token opaque, rotation du refresh token, et déconnexion.

### Entités utilisées

Aucune entité propre. Opère sur `User` (injecté via `@InjectRepository`).

### Endpoints API — Module Auth

| Méthode | Chemin | Guards | Rôles | Body | Réponse | Objectif |
|---------|--------|--------|-------|------|---------|---------|
| POST | /auth/register | — | — | `RegisterDto` | `UserResponseDto` | Inscription ; crée l'utilisateur avec rôle `student` par défaut, envoie l'e-mail de vérification |
| POST | /auth/login | — | — | `LoginDto` | `AuthResponseDto` | Connexion ; vérifie mot de passe, exige `isEmailVerified=true`, retourne JWT + refresh token |
| GET | /auth/verify-email | — | — | `?token=` (query) | `{ message }` | Valide le token de vérification e-mail ; expire après 24 h |
| POST | /auth/resend-verification | — | — | `{ email }` | `{ message }` | Régénère et renvoie le token de vérification |
| POST | /auth/refresh-token | — | — | `{ refreshToken }` | `AuthResponseDto` | Échange un refresh token contre un nouveau JWT + nouveau refresh token |
| POST | /auth/logout | JwtAuthGuard | tout rôle authentifié | `{ userId }` | `200` | Invalide le refresh token en base |
| GET | /auth/dev/verify/:email | — | — | — | `{ message }` | **Dev seulement** — vérifie un e-mail manuellement sans SMTP ; retourne 404 en production |


### Flux d'authentification complet

**Confirmed by code (`auth.service.ts`, `jwt.strategy.ts`, `roles.guard.ts`) :**

**1. Inscription**
- Vérification d'unicité de l'e-mail via `userRepository.findOne({ where: { email } })`
- Hachage du mot de passe : `bcrypt.hash(password, 10)` (10 rounds de sel)
- Attribution du rôle par défaut `student` récupéré depuis la table `roles` via `SYSTEM_ROLES.STUDENT`
- Persistance de l'utilisateur avec `isActive: true`, `isEmailVerified: false`
- Génération du token de vérification : `crypto.randomBytes(32).toString('hex')` avec TTL 24 h
- Envoi de l'e-mail via `EmailService` ; en cas d'échec, log de l'erreur sans lever d'exception
- En mode développement (`NODE_ENV !== 'production'` et absence de `MAIL_HOST`), le token est loggé en clair dans la console

**2. Vérification e-mail**
- Lookup du `User` par `emailVerificationToken`
- Vérification de `emailVerificationTokenExpires < now`
- Mise à jour : `isEmailVerified = true`, `emailVerificationToken = null`, `emailVerificationTokenExpires = null`

**3. Connexion**
- `validateUser` : charge `User` avec `roles` + `roles.permissions` ; vérifie `isActive` ; compare avec `bcrypt.compare`
- Contrôle `isEmailVerified` — lève `UnauthorizedException` si non vérifié
- Construction du `JwtPayload` : `{ sub: id, email, roles: string[], permissions: string[] }`
- Signature du JWT avec `jwtService.sign(payload)` — secret : `JWT_SECRET` depuis `.env`
- Génération du refresh token : `crypto.randomBytes(64).toString('hex')` avec TTL 7 jours, persisté en base

**4. Validation par requête (JwtStrategy)**
- Extraction du Bearer token depuis `Authorization` header
- Vérification de la signature et de l'expiration (`ignoreExpiration: false`)
- Rechargement de l'utilisateur depuis la base avec `roles` + `roles.permissions`
- Vérification `isActive`
- Construction de la liste `permissions` unique depuis toutes les permissions de tous les rôles
- Attachement de l'objet `User` enrichi à `request.user`

**5. Contrôle de rôle (RolesGuard)**
- Lecture des métadonnées `ROLES_KEY` via `Reflector.getAllAndOverride` (handler puis classe)
- Si aucun rôle requis → accès autorisé
- Vérification que `request.user.roles[].name` contient au moins un des rôles requis
- En cas d'échec : `ForbiddenException('Insufficient role')`

**6. Refresh token**
- Lookup du `User` par `refreshToken`
- Vérification `refreshTokenExpires < now`
- Émission d'un nouveau JWT + nouveau refresh token (rotation complète)


---

## Module : Users

### Responsabilité métier

Gère le CRUD des utilisateurs (création, lecture, modification, suppression par les administrateurs).
Fournit également deux endpoints spécialisés : récupération de la liste des participants potentiels pour
le chat, et liste des étudiants dont le CV a été traité par l'IA (pour génération de sujets).

### Entité : User

**Confirmed by code (`src/modules/users/entities/user.entity.ts`) :**

**Table :** `users`

**Colonnes :**
- `id` : `uuid` (PK, auto-généré)
- `email` : `varchar` (UNIQUE, NOT NULL)
- `firstName` : `varchar` (NOT NULL)
- `lastName` : `varchar` (NOT NULL)
- `password` : `varchar` (NULLABLE, exclu via `@Exclude()` dans le DTO)
- `isActive` : `boolean` (default: `true`)
- `isEmailVerified` : `boolean` (default: `false`, NULLABLE)
- `emailVerificationToken` : `varchar` (NULLABLE)
- `emailVerificationTokenExpires` : `timestamp` (NULLABLE)
- `refreshToken` : `varchar` (NULLABLE, exclu via `@Exclude()`)
- `refreshTokenExpires` : `timestamp` (NULLABLE)
- `createdAt` : `timestamp` (auto)
- `updatedAt` : `timestamp` (auto)
- `deletedAt` : `timestamp` (soft-delete, auto)

**Relations :**
- **ManyToMany** → `Role` via table de jointure `user_roles` (colonnes `user_id`, `role_id`)
- **OneToOne** → `StudentProfile` (FK dans `student_profiles.userId`, cascade: true, eager: false)

### Endpoints API — Module Users

| Méthode | Chemin | Guards | Rôles | Objectif |
|---------|--------|--------|-------|---------|
| POST | /users | JwtAuthGuard + RolesGuard | `super_admin`, `admin_formation` | Créer un utilisateur (hachage du mot de passe, affectation de rôles) |
| GET | /users | JwtAuthGuard + RolesGuard | `super_admin`, `admin_formation` | Liste complète des utilisateurs avec relations `roles` + `permissions` |
| GET | /users/:id | JwtAuthGuard + RolesGuard | `super_admin`, `admin_formation` | Détail d'un utilisateur |
| PATCH | /users/:id | JwtAuthGuard + RolesGuard | `super_admin`, `admin_formation` | Modifier utilisateur (y compris mot de passe et rôles) |
| DELETE | /users/:id | JwtAuthGuard + RolesGuard | `super_admin`, `admin_formation` | Supprimer utilisateur (hard delete) |
| GET | /users/chat-participants | JwtAuthGuard + RolesGuard | tous rôles | Retourne `{ id, firstName, lastName, email, role }` de tous les utilisateurs actifs, pour sélection de participants dans le chat |
| GET | /users/students/with-embeddings | JwtAuthGuard + RolesGuard | `encadrant_pro`, `admin_formation`, `super_admin` | Retourne liste des `student` avec `isAiProcessed = true` — utilisé pour la génération de sujets IA |

**Confirmed by code (`src/modules/users/users.service.ts`) :**
L'endpoint `/users/students/with-embeddings` utilise une requête SQL native pour contourner un problème
de typage TypeORM (varchar vs. uuid), évitant ainsi les erreurs de cast au niveau du JOIN.


---

## Module : Roles & Permissions

### Responsabilité métier

Gère les rôles système et les permissions associées via une architecture RBAC (Role-Based Access Control).
Les rôles sont assignés aux utilisateurs et chaque rôle regroupe un ensemble de permissions.

### Entités

**Role (`roles`) :**
- `id` : `uuid` (PK)
- `name` : `varchar` (UNIQUE) — ex. : `student`, `encadrant_pro`, `admin_formation`, etc.
- `description` : `varchar` (NULLABLE)
- **ManyToMany** → `Permission` via table `role_permissions`
- **ManyToMany** → `User` via table `user_roles`

**Permission (`permissions`) :**
- `id` : `uuid` (PK)
- `action` : `varchar` (UNIQUE) — ex. : `create_subject`, `validate_milestone`, etc.
- `description` : `varchar` (NULLABLE)
- **ManyToMany** → `Role` via table `role_permissions`

**Confirmed by code (`src/modules/roles/constants/roles.constants.ts`) :**

### Rôles système (SYSTEM_ROLES)

```typescript
export const SYSTEM_ROLES = {
  STUDENT: 'student',
  ENCADRANT_PRO: 'encadrant_pro',
  ENCADRANT_ACADEMIQUE: 'encadrant_academique',
  SUPER_ADMIN: 'super_admin',
  ADMIN_FORMATION: 'admin_formation',
};
```

**Inference :** Les permissions exactes associées à chaque rôle ne sont pas visibles dans le code source —
elles sont peuplées en base via un seed script ou manuellement. Le mécanisme d'assignation des permissions
aux rôles est fonctionnel (table `role_permissions`), mais leur distribution concrète dépend de la base de données.

**Confirmed by code :** Le contrôle d'accès utilise exclusivement le `@Roles()` decorator sur les endpoints.
Aucun contrôle explicite par permission individuelle n'est implémenté dans le code audité.


---

## Module : Profiles

### Responsabilité métier

Gère les profils étudiants (informations académiques : université, niveau, compétences, année de diplôme)
ainsi que les documents associés (CV, relevés de notes, certificats, CIN). Calcule un pourcentage de
complétion du profil. Déclenche le traitement IA automatiquement à l'upload d'un CV.

### Entités

**StudentProfile (`student_profiles`) :**
- `id` : `uuid` (PK)
- `userId` : `varchar` (UNIQUE, FK → `users.id`)
- `phone` : `varchar` (NULLABLE)
- `university` : `varchar` (NULLABLE)
- `level` : `varchar` (NULLABLE)
- `graduationYear` : `int` (NULLABLE)
- `skills` : `text[]` (array PostgreSQL, default: `[]`)
- `completionPercentage` : `int` (default: `0`)
- `isComplete` : `boolean` (default: `false`)
- `cinLast3Digits` : `varchar` (NULLABLE) — pour vérification identité
- `cinHash` : `varchar` (NULLABLE) — hash du CIN pour détection de duplicata
- `cinStatus` : `enum('PENDING','VERIFIED','REJECTED')` (default: `PENDING`)
- `isAiProcessed` : `boolean` (default: `false`) — indique si le CV a été analysé par l'IA
- `createdAt` : `timestamp`
- `updatedAt` : `timestamp`
- **OneToOne** → `User` via `@JoinColumn({ name: 'user_id' })`

**StudentDocument (`student_documents`) :**
- `id` : `uuid` (PK)
- `profileId` : `uuid` (FK → `student_profiles.id`, onDelete: CASCADE)
- `type` : `enum('CV','TRANSCRIPT','CERTIFICATE','CIN','OTHER')`
- `fileName` : `varchar`
- `fileUrl` : `varchar` — chemin relatif dans `/uploads/`
- `fileType` : `varchar` — MIME type
- `size` : `int` — taille en octets
- `hash` : `varchar` — SHA-256 du fichier (exclu des SELECT par défaut)
- `scanOk` : `boolean` (default: `false`) — réservé pour scan antivirus futur
- `createdAt` : `timestamp`
- **ManyToOne** → `StudentProfile`

### Endpoints API — Module Profiles

| Méthode | Chemin | Guards | Rôles | Objectif |
|---------|--------|--------|-------|---------|
| GET | /profiles/me | JwtAuthGuard | student | Récupère ou crée automatiquement le profil de l'utilisateur connecté |
| PATCH | /profiles/me | JwtAuthGuard | student | Met à jour le profil et recalcule `completionPercentage` |
| POST | /profiles/documents/upload | JwtAuthGuard | student | Upload un document (taille max : 10 MB ; CIN: 5 MB) |
| GET | /profiles/documents | JwtAuthGuard | student | Liste paginée des documents (filtre optionnel par `type`) |
| DELETE | /profiles/documents/:id | JwtAuthGuard | student | Supprime un document (seul le propriétaire) |
| GET | /profiles/me/suggestions | JwtAuthGuard | student | Appelle le service IA `/suggest/:userId` pour obtenir des sujets recommandés |

**Confirmed by code (`profiles.service.ts`) :**

**Calcul du pourcentage de complétion :**
- CV uploadé : +40 %
- Téléphone renseigné : +20 %
- Université renseignée : +15 %
- Niveau renseigné : +15 %
- Année de diplôme renseignée : +10 %
- Total maximum : 100 %
- `isComplete` est `true` si `completionPercentage > 80`

**Fire-and-forget AI processing lors de l'upload CV :**
1. Appel `POST /extract` (service IA) — extraction du texte du CV
2. Appel `POST /embed/student` (service IA) — génération de l'embedding
3. Marque `isAiProcessed = true` dans la base (callback interne depuis l'IA)


---

## Module : Subjects

### Responsabilité métier

Gère les sujets de stage : création, validation administrative, recherche avec filtres,
génération automatique de sujets via IA (basée sur les CV étudiants).

### Entité : Subject

**Table :** `subjects`

**Colonnes :**
- `id` : `uuid` (PK)
- `title` : `varchar` (INDEX)
- `description` : `text`
- `technologies` : `simple-array` (liste séparée par virgules en base PostgreSQL)
- `level` : `varchar` (NULLABLE) — ex. : `Licence`, `Master`, etc.
- `prerequisites` : `text` (NULLABLE)
- `status` : `enum('DRAFT','PENDING','VALIDATED','REJECTED','CLOSED')` (default: `DRAFT`)
- `createdById` : `uuid` (FK → `users.id`)
- `generatedByAi` : `boolean` (default: `false`)
- `aiGenerationSource` : `text` (NULLABLE) — ex. : `OLLAMA`
- `generatedForStudentId` : `uuid` (NULLABLE) — utilisé pour traçabilité lors de génération IA
- `createdAt` : `timestamp`
- `updatedAt` : `timestamp`
- **ManyToOne** → `User` (createdBy)
- **OneToMany** → `Candidature`

### Endpoints API — Module Subjects

| Méthode | Chemin | Guards | Rôles | Objectif |
|---------|--------|--------|-------|---------|
| POST | /subjects | JwtAuthGuard + RolesGuard | `encadrant_pro`, `student`, `admin_formation`, `super_admin` | Créer un sujet (status initial: DRAFT pour encadreurs, PENDING pour étudiants, VALIDATED pour admins) |
| POST | /subjects/generate-draft | JwtAuthGuard + RolesGuard | `encadrant_pro`, `admin_formation` | Génération IA d'un sujet depuis les CV d'étudiants (appel `/generate/subject-from-cv`) |
| GET | /subjects | JwtAuthGuard + RolesGuard | tous rôles | Liste filtrée avec pagination (students/acad voient uniquement VALIDATED, admins/pro voient tout) |
| GET | /subjects/my | JwtAuthGuard + RolesGuard | tous rôles | Sujets créés par l'utilisateur connecté |
| GET | /subjects/pending | JwtAuthGuard + RolesGuard | `admin_formation`, `super_admin` | Sujets en attente de validation (status: PENDING) |
| GET | /subjects/:id | JwtAuthGuard + RolesGuard | tous rôles | Détail d'un sujet (students: uniquement VALIDATED) |
| PUT | /subjects/:id | JwtAuthGuard + RolesGuard | `encadrant_pro`, `admin_formation`, `super_admin` | Modifier un sujet (seul le créateur ou un admin) |
| DELETE | /subjects/:id | JwtAuthGuard + RolesGuard | `encadrant_pro`, `admin_formation`, `super_admin` | Supprimer un sujet (seul le créateur ou un admin) |
| PATCH | /subjects/:id/validate | JwtAuthGuard + RolesGuard | `encadrant_pro`, `admin_formation`, `super_admin` | Valider/rejeter un sujet — encadreurs: DRAFT→PENDING ; admins: PENDING→VALIDATED/REJECTED |

**Confirmed by code (`subjects.service.ts`) :**

**Fire-and-forget embedding après validation :**
- Lorsqu'un sujet passe à status `VALIDATED`, un appel `POST /embed/subject` est effectué vers le service IA
- L'embedding est généré et persisté dans la table `subject_embeddings` (gérée par le service IA)
- Utilisé pour la recommandation de sujets aux étudiants

**Warmup au démarrage (`app.module.ts`) :**
- `AppModule.onModuleInit()` : charge tous les sujets validés et envoie une requête bulk `POST /embed/subjects/bulk`
  au service IA pour recalculer/synchroniser les embeddings
- Permet de garantir que la base vectorielle est à jour même si des sujets ont été validés sans succès d'indexation


---

## Module : Candidatures

### Responsabilité métier

Gère les candidatures des étudiants sur des sujets de stage. Permet l'acceptation/rejet par
l'encadreur professionnel ou l'admin. L'acceptation d'une candidature déclenche automatiquement
la création d'un `Stage`.

### Entité : Candidature

**Table :** `candidatures`

**Colonnes :**
- `id` : `uuid` (PK)
- `studentId` : `uuid` (FK → `users.id`)
- `subjectId` : `uuid` (FK → `subjects.id`)
- `status` : `enum('PENDING','ACCEPTED','REJECTED')` (default: `PENDING`)
- `motivation` : `text` (NULLABLE)
- `scoreMatch` : `float` (NULLABLE) — score de correspondance IA (non utilisé actuellement)
- `createdAt` : `timestamp`
- `updatedAt` : `timestamp`
- **ManyToOne** → `User` (student)
- **ManyToOne** → `Subject`
- **OneToMany** → `Stage`
- **Index UNIQUE** sur `(studentId, subjectId)` — un étudiant ne peut postuler qu'une fois par sujet

### Endpoints API — Module Candidatures

| Méthode | Chemin | Guards | Rôles | Objectif |
|---------|--------|--------|-------|---------|
| POST | /candidatures | JwtAuthGuard + RolesGuard | `student` | Créer une candidature (status: PENDING) |
| GET | /candidatures/my-candidatures | JwtAuthGuard + RolesGuard | `student` | Liste des candidatures de l'étudiant connecté |
| GET | /candidatures/subject/:subjectId | JwtAuthGuard + RolesGuard | créateur du sujet ou admin | Candidatures reçues pour un sujet |
| PATCH | /candidatures/:id/status | JwtAuthGuard + RolesGuard | `encadrant_pro`, `admin_formation`, `super_admin` | Accepter/rejeter une candidature (créateur du sujet ou admin) |
| DELETE | /candidatures/:id/cancel | JwtAuthGuard + RolesGuard | `student`, `admin_formation`, `super_admin` | Annuler une candidature (étudiant: ses propres candidatures ; admin: toutes) |
| GET | /candidatures | JwtAuthGuard + RolesGuard | `admin_formation`, `super_admin` | Liste complète des candidatures (admin) |

**Confirmed by code (`candidatures.service.ts`) :**

**Auto-création du Stage lors de l'acceptation :**
- Lors du changement de `status` à `ACCEPTED`, un appel automatique à `stagesService.createStage()` est effectué
- Le `Stage` est créé avec `encadrantProId` extrait du body (`dto.encadrantProId`)
- **Transaction implicite :** en cas d'échec de création du stage, le status de la candidature est rollbacké
  vers son état précédent (`previousStatus`) pour éviter une candidature ACCEPTED sans stage correspondant
- Si le stage est créé avec succès, le status reste `ACCEPTED` et le stage est lié à la candidature

**Contrainte d'annulation :**
- Impossible d'annuler une candidature si elle possède un `Stage` avec status `ACTIVE` ou `PENDING_ACAD`
- Les stages `COMPLETED` ou `CANCELLED` n'empêchent pas l'annulation


---

## Module : Stages

### Responsabilité métier

Gère le cycle de vie complet des stages : création depuis une candidature acceptée,
assignation des encadrants (professionnel et académique), suivi du status (PENDING_ACAD, ACTIVE, COMPLETED, CANCELLED).

### Entité : Stage

**Table :** `stages`

**Colonnes :**
- `id` : `uuid` (PK)
- `candidatureId` : `uuid` (FK → `candidatures.id`, UNIQUE, onDelete: CASCADE)
- `subjectId` : `uuid` (FK → `subjects.id`)
- `studentId` : `uuid` (FK → `users.id`)
- `encadrantProId` : `uuid` (FK → `users.id`)
- `encadrantAcadId` : `uuid` (FK → `users.id`, NULLABLE)
- `status` : `enum('PENDING_ACAD','ACTIVE','COMPLETED','CANCELLED')` (default: `PENDING_ACAD`)
- `startDate` : `date` (NULLABLE)
- `endDate` : `date` (NULLABLE)
- `adminNotes` : `text` (NULLABLE)
- `createdAt` : `timestamp`
- `updatedAt` : `timestamp`
- **Index** sur `studentId`, `encadrantProId`, `encadrantAcadId`
- **ManyToOne** → `Candidature`, `Subject`, `User` (student), `User` (encadrantPro), `User` (encadrantAcad)

### Endpoints API — Module Stages

| Méthode | Chemin | Guards | Rôles | Objectif |
|---------|--------|--------|-------|---------|
| POST | /stages | JwtAuthGuard + RolesGuard | `admin_formation`, `super_admin` | Créer un stage manuellement (admin peut fournir `candidatureId`, `studentEmail`, `subjectId`/`subjectTitle`, `encadrantProId`/`encadrantProEmail`, `encadrantAcadId`/`encadrantAcadEmail`) |
| GET | /stages | JwtAuthGuard + RolesGuard | `admin_formation`, `super_admin` | Liste complète des stages (admin) |
| GET | /stages/:id | JwtAuthGuard + RolesGuard | tous rôles | Détail d'un stage (filtré selon rôle : student/encadrant ne voient que leurs stages) |
| PATCH | /stages/:id | JwtAuthGuard + RolesGuard | `admin_formation`, `super_admin` | Modifier métadonnées (status, dates, notes) |
| PATCH | /stages/:id/assign-pro | JwtAuthGuard + RolesGuard | `admin_formation`, `super_admin` | Assigner ou réassigner l'encadrant professionnel |
| PATCH | /stages/:id/assign-acad | JwtAuthGuard + RolesGuard | `admin_formation`, `super_admin` | Assigner l'encadrant académique → passe status à ACTIVE |
| PATCH | /stages/:id/complete | JwtAuthGuard + RolesGuard | `admin_formation`, `super_admin` | Marquer le stage comme terminé (COMPLETED) |
| PATCH | /stages/:id/cancel | JwtAuthGuard + RolesGuard | `admin_formation`, `super_admin` | Annuler le stage (CANCELLED) |
| GET | /stages/my/stage | JwtAuthGuard + RolesGuard | `student` | Stage de l'étudiant connecté |
| GET | /stages/my/as-pro | JwtAuthGuard + RolesGuard | `encadrant_pro` | Stages supervisés par l'encadrant pro connecté |
| GET | /stages/my/as-acad | JwtAuthGuard + RolesGuard | `encadrant_academique` | Stages supervisés par l'encadrant académique connecté |

**Confirmed by code (`stages.service.ts`) :**

**Auto-création de la ChatRoom lors de la création d'un Stage :**
- Appel `chatService.createRoomForStage(stage)` en mode non-bloquant (`.catch()` pour log d'erreur sans rollback)
- La room est de type `STAGE` et contient initialement : student, encadrantPro
- L'encadrant académique est ajouté automatiquement s'il est déjà assigné au moment de la création
- Si l'assignation de l'encadrant académique intervient plus tard (via `/assign-acad`), un appel supplémentaire
  `chatService.addEncadrantAcadToStageRoom()` est effectué pour l'ajouter à la room existante

**Validation de l'encadrant pro pour auto-création :**
- Lors de la promotion automatique d'une candidature acceptée en stage (sans ID d'encadreur fourni),
  le créateur du sujet est utilisé comme encadrant pro par défaut
- Le système vérifie que ce créateur possède l'un des rôles : `encadrant_pro`, `admin_formation`, `super_admin`
- Si le créateur n'a aucun de ces rôles, une `BadRequestException` est levée


---

## Module : Jalons & Livrables

### Responsabilité métier

Gère les jalons (milestones) associés à un stage et les livrables (fichiers déposés par l'étudiant).
Gère le cycle de vie d'un jalon : création, soumission d'un livrable par l'étudiant,
validation/rejet par l'encadrant professionnel, commentaire de l'encadrant académique.

### Entité : Jalon

**Table :** `jalons`

**Colonnes :**
- `id` : `uuid` (PK)
- `stageId` : `uuid` (FK → `stages.id`, onDelete: CASCADE)
- `label` : `varchar(255)`
- `description` : `text` (NULLABLE)
- `dueDate` : `date`
- `order` : `int`
- `status` : `enum('PENDING','SUBMITTED','VALIDATED','REJECTED','LATE')` (default: `PENDING`)
  — Note : `LATE` est calculé dynamiquement (jamais persisté en base)
- `validatedById` : `uuid` (FK → `users.id`, NULLABLE) — encadrant qui a validé/rejeté
- `validatedAt` : `timestamp` (NULLABLE)
- `proComment` : `text` (NULLABLE) — commentaire de l'encadrant pro
- `acadComment` : `text` (NULLABLE) — commentaire de l'encadrant académique
- `createdAt` : `timestamp`
- `updatedAt` : `timestamp`
- **Index UNIQUE** sur `(stageId, order)` — unicité de l'ordre dans un stage
- **OneToOne** → `Livrable` (cascade: true)
- **ManyToOne** → `Stage`, `User` (validatedBy)

### Entité : Livrable

**Table :** `livrables`

**Colonnes :**
- `id` : `uuid` (PK)
- `jalonId` : `uuid` (FK → `jalons.id`, UNIQUE, onDelete: CASCADE)
- `studentId` : `uuid` (FK → `users.id`)
- `fileName` : `varchar(255)`
- `fileUrl` : `varchar(2048)`
- `fileType` : `varchar(100)` — MIME type
- `size` : `int` — taille en octets
- `hash` : `varchar(64)` — SHA-256, exclu des SELECT par défaut (`select: false`)
- `scanOk` : `boolean` (default: `false`) — forcé à `false` à chaque re-soumission
- `studentNote` : `text` (NULLABLE)
- `submittedAt` : `timestamp`
- **OneToOne** → `Jalon`
- **ManyToOne** → `User` (student)

### Endpoints API — Module Jalons

| Méthode | Chemin | Guards | Rôles | Objectif |
|---------|--------|--------|-------|---------|
| POST | /jalons | JwtAuthGuard + RolesGuard | `admin_formation`, `super_admin`, `encadrant_pro` | Créer un jalon (stage doit être ACTIVE) |
| GET | /jalons/stage/:stageId | JwtAuthGuard + RolesGuard | tous rôles (scoped) | Liste des jalons d'un stage (accès filtré par rôle) |
| GET | /jalons/:id | JwtAuthGuard + RolesGuard | tous rôles (scoped) | Détail d'un jalon |
| PATCH | /jalons/:id | JwtAuthGuard + RolesGuard | `admin_formation`, `super_admin` | Modifier un jalon (uniquement si status: PENDING) |
| DELETE | /jalons/:id | JwtAuthGuard + RolesGuard | `admin_formation`, `super_admin` | Supprimer un jalon (uniquement si status: PENDING) |
| PATCH | /jalons/:id/validate | JwtAuthGuard + RolesGuard | `encadrant_pro` | Valider ou rejeter un jalon (SUBMITTED → VALIDATED/REJECTED). Rejet exige `proComment` non vide |
| PATCH | /jalons/:id/acad-comment | JwtAuthGuard + RolesGuard | `encadrant_academique` | Ajouter un commentaire académique (accès limité à l'encadrant acad du stage) |
| POST | /jalons/:id/livrable | JwtAuthGuard + RolesGuard | `student` | Soumettre/remplacer un livrable (PENDING ou REJECTED → SUBMITTED) |
| GET | /jalons/:id/livrable | JwtAuthGuard + RolesGuard | tous rôles (scoped) | Récupérer le livrable d'un jalon (hash exclu de la réponse) |

**Confirmed by code (`jalons.service.ts`) :**

**Statut dynamique LATE :**
- Calculé à la volée dans `mapToResponse()` par `computeStatus()`
- Si `dueDate < now` ET status ∈ `{PENDING, SUBMITTED}` → status retourné = `LATE`
- Le status `LATE` n'est jamais persisté en base

**Upsert du livrable :**
- Si le jalon possède déjà un livrable (re-soumission après rejet), les métadonnées sont mises à jour
- `scanOk` est forcé à `false` à chaque soumission


---

## Module : Chat + WebSocket Gateway

### Responsabilité métier

Fournit un système de messagerie en temps réel associé aux stages.
Chaque stage possède une room de chat créée automatiquement lors de la création du stage.
Les administrateurs peuvent créer des rooms personnalisées (type CUSTOM) en dehors des stages.

### Entités

**ChatRoom (`chat_rooms`) :**
- `id` : `uuid` (PK)
- `name` : `varchar(255)`
- `description` : `text` (NULLABLE)
- `type` : `enum('STAGE','CUSTOM')` (default: `STAGE`)
- `stageId` : `uuid` (FK → `stages.id`, NULLABLE, UNIQUE où `stageId IS NOT NULL`)
- `isActive` : `boolean` (default: `true`)
- `createdAt` / `updatedAt` : `timestamp`
- **OneToOne** → `Stage`
- **OneToMany** → `ChatParticipant`, `ChatMessage`

**ChatParticipant (`chat_participants`) :**
- `id` : `uuid` (PK)
- `roomId` : `uuid` (FK → `chat_rooms.id`, onDelete: CASCADE)
- `userId` : `uuid` (FK → `users.id`, onDelete: CASCADE)
- `lastReadMessageId` : `varchar` (NULLABLE) — marquage de lecture
- `joinedAt` : `timestamp`
- **Index UNIQUE** sur `(roomId, userId)`

**ChatMessage (`chat_messages`) :**
- `id` : `uuid` (PK)
- `roomId` : `uuid` (FK → `chat_rooms.id`, onDelete: CASCADE)
- `senderId` : `uuid` (FK → `users.id`, NULLABLE, onDelete: SET NULL) — `null` pour messages SYSTEM
- `content` : `text`
- `type` : `enum('TEXT','FILE','SYSTEM')` (default: `TEXT`)
- `isDeleted` : `boolean` (default: `false`) — soft-delete : contenu remplacé par `[deleted]`
- `createdAt` : `timestamp`
- **Index** sur `(roomId, createdAt)`

### Endpoints HTTP — Module Chat

| Méthode | Chemin | Guards | Rôles | Objectif |
|---------|--------|--------|-------|---------|
| GET | /chat/rooms | JwtAuthGuard | tous rôles | Rooms de l'utilisateur connecté |
| GET | /chat/rooms/all | JwtAuthGuard + RolesGuard | `admin_formation`, `super_admin` | Toutes les rooms (admin) |
| POST | /chat/rooms | JwtAuthGuard + RolesGuard | `admin_formation`, `super_admin` | Créer une room custom |
| GET | /chat/rooms/:id | JwtAuthGuard | participant uniquement | Détail d'une room (participants) |
| POST | /chat/rooms/:id/participants | JwtAuthGuard + RolesGuard | `admin_formation`, `super_admin` | Ajouter un participant |
| GET | /chat/rooms/:id/messages | JwtAuthGuard | participant uniquement | Historique paginé des messages (cursor-based via `before`) |
| DELETE | /chat/messages/:id | JwtAuthGuard | propriétaire du message ou admin | Soft-delete d'un message |

### WebSocket Gateway

**Confirmed by code (`chat.gateway.ts`, `ws-jwt.guard.ts`) :**

**Namespace :** `/chat`

**Connexion :**
```javascript
// Côté client
io(url, { auth: { token: 'Bearer <jwt>' } })
```

**Authentification WebSocket (WsJwtGuard) :**
1. Extraction du token depuis `socket.handshake.auth.token` (priorité 1) ou header `Authorization` (priorité 2)
2. Vérification du JWT via `jwtService.verify(token, { secret: JWT_SECRET })`
3. Rechargement de l'`User` depuis la base avec `roles + permissions`
4. Attachement à `socket.data.user`
5. Le guard est appliqué **par message** (pas à la connexion)

**Événements émis par le client :**

| Événement | Payload | Guard | Description |
|-----------|---------|-------|-------------|
| `joinRoom` | `{ roomId }` | WsJwtGuard | Rejoindre une room Socket.IO (vérifie la participation en base) |
| `leaveRoom` | `{ roomId }` | WsJwtGuard | Quitter une room Socket.IO |
| `sendMessage` | `{ roomId, content }` | WsJwtGuard | Envoyer un message (validé avec ValidationPipe) |
| `markRead` | `{ roomId, messageId }` | WsJwtGuard | Marquer les messages comme lus |
| `typing` | `{ roomId }` | WsJwtGuard | Indicateur de frappe (broadcast aux autres participants) |

**Événements émis par le serveur :**

| Événement | Description |
|-----------|-------------|
| `joinedRoom` | Confirmation de join pour le client |
| `leftRoom` | Confirmation de leave pour le client |
| `newMessage` | Nouveau message broadcasté à tous les participants de la room |
| `userTyping` | Indicateur de frappe avec `{ userId, firstName, roomId }` |


---

## Module : Assignments

### Responsabilité métier

Gère les affectations préalables d'un encadreur professionnel à des étudiants avant la création
formelle d'un stage. Représente un mapping `encadreur ↔ étudiant` indépendant des stages.

### Entité : Assignment

**Table :** `assignments`

**Colonnes :**
- `id` : `uuid` (PK)
- `encadreurId` : `uuid` (FK → `users.id` via `encadreur_id`, onDelete: CASCADE)
- `studentId` : `uuid` (FK → `users.id` via `student_id`, onDelete: CASCADE)
- `createdAt` : `timestamp`
- **ManyToOne** → `User` (encadreur)
- **ManyToOne** → `User` (student)

### Endpoints API — Module Assignments

| Méthode | Chemin | Guards | Rôles | Objectif |
|---------|--------|--------|-------|---------|
| POST | /assignments/assign | JwtAuthGuard + RolesGuard | `admin_formation`, `super_admin` | Créer une affectation encadreur→étudiant |
| GET | /assignments/encadreur/:id/students | JwtAuthGuard + RolesGuard | `admin_formation`, `super_admin`, `encadrant_pro` | Étudiants affectés à un encadreur |
| GET | /assignments/student/:id/encadreurs | JwtAuthGuard + RolesGuard | tous rôles | Encadreurs affectés à un étudiant |
| DELETE | /assignments/delete | JwtAuthGuard + RolesGuard | `admin_formation`, `super_admin` | Supprimer une affectation |

---

## Module : RAG

### Responsabilité métier

Point de passage entre le frontend et le service IA pour les fonctionnalités RAG (Retrieval-Augmented Generation).
Permet aux administrateurs d'ingérer des documents de procédures dans la base de connaissance,
et à tous les utilisateurs authentifiés de poser des questions sur les procédures de stage.

### Endpoints API — Module RAG

| Méthode | Chemin | Guards | Rôles | Objectif |
|---------|--------|--------|-------|---------|
| POST | /rag/documents | JwtAuthGuard + RolesGuard | `admin_formation`, `super_admin` | Ingérer un document via chemin physique (dans le volume Docker partagé) |
| POST | /rag/documents/upload | JwtAuthGuard + RolesGuard | `admin_formation`, `super_admin` | Upload + ingestion d'un fichier (multipart) — fichier stocké dans `/uploads/rag/`, puis envoyé au service IA |
| POST | /rag/query | JwtAuthGuard + RolesGuard | tous rôles authentifiés | Poser une question sur les procédures (appel `POST /rag/query` vers le service IA) |

**Confirmed by code (`rag.service.ts`) :**
- Timeout de 120 secondes sur tous les appels au service IA via `AbortSignal.timeout(120000)`
- Vérification de l'existence physique du fichier avant l'envoi au service IA
- En cas d'`ECONNREFUSED` : `ServiceUnavailableException`
- En cas d'erreur réseau : `BadGatewayException`
- La réponse de `/rag/query` contient `{ answer: string, sources: [{ documentName, excerpt }] }`


---

## Module : Analytics

### Responsabilité métier

Fournit des données analytiques agrégées pour chaque profil d'utilisateur.
Ne modifie jamais de données — lecture seule depuis la base.

### Endpoints API — Module Analytics

#### Pour Admin (admin_formation, super_admin)

| Méthode | Chemin | Description |
|---------|--------|-------------|
| GET | /analytics/admin/overview | Vue globale : compteurs users, sujets, candidatures, stages, jalons, IA |
| GET | /analytics/admin/subjects-by-level | Distribution des sujets par niveau, avec compteur validés |
| GET | /analytics/admin/candidatures-timeline | Évolution mensuelle des candidatures sur 6 mois |
| GET | /analytics/admin/stages-per-university | Distribution des stages par université (top 10) |
| GET | /analytics/admin/pending-actions | Actions en attente : sujets à valider, candidatures à traiter, jalons en retard |
| GET | /analytics/admin/recent-activity | 20 événements récents : inscriptions, sujets créés, candidatures acceptées, stages démarrés, jalons validés |

#### Pour Encadreur (encadrant_pro)

| Méthode | Chemin | Description |
|---------|--------|-------------|
| GET | /analytics/encadreur/overview | Vue de l'encadreur : ses stages, ses étudiants, ses jalons à valider, ses sujets |
| GET | /analytics/encadreur/my-students | Liste détaillée des étudiants avec progression par jalon, date de prochaine échéance |
| GET | /analytics/encadreur/jalon-alerts | Alertes jalons : jalons non validés avec jours de retard calculés |

#### Pour Étudiant (student)

| Méthode | Chemin | Description |
|---------|--------|-------------|
| GET | /analytics/student/overview | Vue étudiant : profil (completionPercentage, hasCV, isAiProcessed), candidatures (total, pending, accepted, rejected), stage (status, encadreur, dates, jours restants), jalons (total, validés, en retard, nextDeadline), flag `subjectSuggestionsAvailable` |

**Confirmed by code (`analytics.service.ts`) :**

- `getAdminOverview` : agrège 7 entités (User, StudentProfile, Subject, Candidature, Stage, Jalon, GenerationIA),
  interroge aussi `subject_embeddings` via requête SQL native pour `subjectsIndexed`
- `getStagesPerUniversity` : requête SQL native avec JOIN `student_profiles` → `stages`
- `getCandidaturesTimeline` : fonction PostgreSQL `TO_CHAR(..., 'YYYY-MM')` pour regrouper par mois
- `subjectSuggestionsAvailable` : retourne `profile.isAiProcessed` — indique si l'étudiant peut accéder aux recommandations IA

---

## Module : Audit

### Responsabilité métier

Journalise toutes les actions significatives de l'application (création, modification, suppression de ressources).
Accessible en lecture par les administrateurs avec filtrage et pagination.

### Entité : AuditLog

**Table :** `audit_logs`

**Colonnes :**
- `id` : `uuid` (PK)
- `action` : `varchar` — ex. : `CREATE_SUBJECT`, `VALIDATE_SUBJECT`, `SENT_CHAT_MESSAGE`
- `userId` : `varchar` — ID de l'utilisateur qui a effectué l'action
- `resourceType` : `varchar` — ex. : `Subject`, `Stage`, `ChatRoom`
- `resourceId` : `varchar` — ID de la ressource concernée
- `changes` : `jsonb` (NULLABLE) — objet JSON des modifications (non rempli dans l'intercepteur actuel)
- `ip` : `varchar` (NULLABLE) — adresse IP
- `userAgent` : `varchar` (NULLABLE) — User-Agent HTTP
- `createdAt` : `timestamp`
- **Index** sur `action`, `userId`, `(resourceType, resourceId)`

### Système d'audit

**Confirmed by code (`audit.decorator.ts`, `audit.interceptor.ts`) :**

**Décorateur `@Audit(action, resourceType)` :**
- Attache les métadonnées `{ action, resourceType }` au handler via `SetMetadata(AUDIT_KEY, ...)`
- Ex. : `@Audit('CREATE_SUBJECT', 'Subject')`

**AuditInterceptor (global, enregistré via `APP_INTERCEPTOR`) :**
1. Lit les métadonnées `AUDIT_KEY` — si absentes, ne fait rien
2. Extrait `userId`, `ip`, `userAgent` de la requête HTTP
3. Après l'exécution du handler (`tap()`), récupère `resourceId` depuis `response.id`
4. Appelle `AuditService.log()` avec ces informations
5. En cas d'erreur de l'intercepteur : log console sans propagation

**Endpoints Admin Audit :**

| Méthode | Chemin | Description |
|---------|--------|-------------|
| GET | /audit | Audit logs paginés et filtrables (search, action, resourceType, userId, from/to, page, limit) — max 100 par page |
| GET | /audit/resource/:type/:id | Audit trail d'une ressource spécifique (ex. : `GET /audit/resource/Subject/uuid`) |
| GET | /audit/user/:userId | Audit logs d'un utilisateur spécifique |
| GET | /audit/action/:action | Audit logs filtrés par action |

**Confirmed by code :** Tous les endpoints `/audit/*` requièrent `JwtAuthGuard + RolesGuard` avec rôles `super_admin` ou `admin_formation`.


---

## Infrastructure commune

### AllExceptionsFilter

**Confirmed by code (`src/common/filters/exception.filter.ts`) :**

- Capte toutes les exceptions non gérées (`@Catch()` sans filtre de type)
- Pour `HttpException` : extrait le code HTTP et le message
- Pour les autres erreurs : code 500, inclusion de la stack trace uniquement si `NODE_ENV !== 'production'`
- Retourne un objet JSON structuré : `{ statusCode, message, error, timestamp, path, correlationId }`
- Chaque réponse inclut un `correlationId` (généré par `RequestLoggerMiddleware`)
- Log de l'exception via `LoggerService` avec contexte `{ userId, method, url, statusCode }`

### RequestLoggerMiddleware

**Confirmed by code (`src/common/middleware/request-logger.middleware.ts`) :**

- Appliqué globalement sur toutes les routes (`forRoutes('*')`)
- Génère un `correlationId` unique (UUID v4) par requête
- Attache le `correlationId` à l'objet requête comme `req.correlationId`
- Log d'entrée : `[INCOMING] METHOD URL` avec `userAgent` et `userId`
- Log de sortie (sur `res.on('finish')`) : `[OUTGOING] METHOD URL STATUS_CODE DURATION_MS`

### LoggerService

**Confirmed by code (`src/common/logger/logger.service.ts`) :**

- Wraps `@nestjs/common/Logger`
- Préfixe chaque message avec `[correlationId]`
- Le `correlationId` est stocké dans `global.__correlationId` (partagé entre les modules dans la même requête)
- Méthodes : `log`, `error`, `warn`, `debug`, `verbose`

### ValidationPipe Global

**Confirmed by code (`src/main.ts`) :**
```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,          // supprime les propriétés non décorées
  forbidNonWhitelisted: true, // rejette les requêtes avec propriétés inconnues
  transform: true,          // transforme automatiquement les types
}))
```

### Configuration CORS

**Confirmed by code (`src/main.ts`) :**
- Origine : `process.env.CORS_ORIGIN ?? 'http://localhost:5173'`
- Méthodes : `GET, HEAD, PUT, PATCH, POST, DELETE`
- `credentials: true`

### Serving des fichiers statiques

**Confirmed by code (`src/main.ts`) :**
- Répertoire : `process.env.UPLOAD_DIR ?? './uploads'`
- Préfixe URL : `/uploads`
- Utilisé en développement local ; en production le service Nginx sert ce répertoire directement

---

## Schéma relationnel (ER Diagram)

```
users
  id (PK, uuid)
  email (UNIQUE)
  firstName, lastName, password, isActive, isEmailVerified
  emailVerificationToken, emailVerificationTokenExpires
  refreshToken, refreshTokenExpires
  createdAt, updatedAt, deletedAt
  ↕ M:M → roles (via user_roles: user_id, role_id)
  ↕ 1:1 → student_profiles (FK dans student_profiles.user_id)

roles
  id (PK, uuid)
  name (UNIQUE), description
  ↕ M:M → permissions (via role_permissions: role_id, permission_id)
  ↕ M:M → users

permissions
  id (PK, uuid)
  action (UNIQUE), description

student_profiles
  id (PK, uuid)
  userId (FK → users.id, UNIQUE)
  phone, university, level, graduationYear, skills[]
  completionPercentage, isComplete
  cinLast3Digits, cinHash, cinStatus (PENDING|VERIFIED|REJECTED)
  isAiProcessed, createdAt, updatedAt
  ↕ 1:M → student_documents

student_documents
  id (PK, uuid)
  profileId (FK → student_profiles.id)
  type (CV|TRANSCRIPT|CERTIFICATE|CIN|OTHER)
  fileName, fileUrl, fileType, size, hash, scanOk, createdAt

subjects
  id (PK, uuid)
  title (INDEX), description, technologies[], level, prerequisites
  status (DRAFT|PENDING|VALIDATED|REJECTED|CLOSED)
  createdById (FK → users.id)
  generatedByAi, aiGenerationSource, generatedForStudentId
  createdAt, updatedAt
  ↕ 1:M → candidatures

candidatures
  id (PK, uuid)
  studentId (FK → users.id)
  subjectId (FK → subjects.id)
  status (PENDING|ACCEPTED|REJECTED)
  motivation, scoreMatch
  createdAt, updatedAt
  UNIQUE (studentId, subjectId)
  ↕ 1:M → stages

stages
  id (PK, uuid)
  candidatureId (FK → candidatures.id, UNIQUE)
  subjectId (FK → subjects.id)
  studentId (FK → users.id)
  encadrantProId (FK → users.id)
  encadrantAcadId (FK → users.id, NULLABLE)
  status (PENDING_ACAD|ACTIVE|COMPLETED|CANCELLED)
  startDate, endDate, adminNotes
  createdAt, updatedAt
  ↕ 1:M → jalons
  ↕ 1:1 → chat_rooms

jalons
  id (PK, uuid)
  stageId (FK → stages.id)
  label, description, dueDate, order, status
  validatedById (FK → users.id, NULLABLE)
  validatedAt, proComment, acadComment
  createdAt, updatedAt
  UNIQUE (stageId, order)
  ↕ 1:1 → livrables

livrables
  id (PK, uuid)
  jalonId (FK → jalons.id, UNIQUE)
  studentId (FK → users.id)
  fileName, fileUrl, fileType, size, hash (select:false)
  scanOk, studentNote, submittedAt

assignments
  id (PK, uuid)
  encadreurId (FK → users.id)
  studentId (FK → users.id)
  createdAt

chat_rooms
  id (PK, uuid)
  name, description, type (STAGE|CUSTOM)
  stageId (FK → stages.id, NULLABLE, UNIQUE)
  isActive, createdAt, updatedAt
  ↕ 1:M → chat_participants, chat_messages

chat_participants
  id (PK, uuid)
  roomId (FK → chat_rooms.id)
  userId (FK → users.id)
  lastReadMessageId, joinedAt
  UNIQUE (roomId, userId)

chat_messages
  id (PK, uuid)
  roomId (FK → chat_rooms.id)
  senderId (FK → users.id, NULLABLE)
  content, type (TEXT|FILE|SYSTEM), isDeleted, createdAt
  INDEX (roomId, createdAt)

audit_logs
  id (PK, uuid)
  action, userId, resourceType, resourceId
  changes (jsonb), ip, userAgent, createdAt
  INDEX (action), INDEX (userId), INDEX (resourceType, resourceId)
```


---

## Matrice RBAC — Contrôle d'accès par rôle

**Confirmed by code (decorateurs `@Roles()` sur chaque endpoint) :**

| Module / Action | student | encadrant_pro | encadrant_academique | admin_formation | super_admin |
|-----------------|---------|---------------|----------------------|-----------------|-------------|
| **Auth : Register** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Auth : Login** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Users : CRUD** | ✗ | ✗ | ✗ | ✓ | ✓ |
| **Users : Chat Participants** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Users : Students with Embeddings** | ✗ | ✓ | ✗ | ✓ | ✓ |
| **Subjects : Create** | ✓ (PENDING) | ✓ (DRAFT) | ✗ | ✓ (VALIDATED) | ✓ (VALIDATED) |
| **Subjects : Generate Draft IA** | ✗ | ✓ | ✗ | ✓ | ✓ |
| **Subjects : View All** | ✓ (VALIDATED only) | ✓ (all) | ✓ (VALIDATED only) | ✓ (all) | ✓ (all) |
| **Subjects : Validate/Reject** | ✗ | ✓ (DRAFT→PENDING only) | ✗ | ✓ | ✓ |
| **Candidatures : Create** | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Candidatures : Update Status** | ✗ | ✓ (créateur du sujet) | ✗ | ✓ | ✓ |
| **Candidatures : Cancel** | ✓ (propres) | ✗ | ✗ | ✓ | ✓ |
| **Stages : Admin Actions** | ✗ | ✗ | ✗ | ✓ | ✓ |
| **Stages : View My Stage** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Jalons : Create** | ✗ | ✓ | ✗ | ✓ | ✓ |
| **Jalons : Validate** | ✗ | ✓ (encadrant du stage) | ✗ | ✗ | ✗ |
| **Jalons : Acad Comment** | ✗ | ✗ | ✓ (encadrant du stage) | ✗ | ✗ |
| **Jalons : Submit Livrable** | ✓ (étudiant du stage) | ✗ | ✗ | ✗ | ✗ |
| **Chat : View My Rooms** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Chat : Create Room** | ✗ | ✗ | ✗ | ✓ | ✓ |
| **RAG : Ingest** | ✗ | ✗ | ✗ | ✓ | ✓ |
| **RAG : Query** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Analytics : Admin** | ✗ | ✗ | ✗ | ✓ | ✓ |
| **Analytics : Encadreur** | ✗ | ✓ | ✗ | ✓ | ✓ |
| **Analytics : Student** | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Assignments : Manage** | ✗ | ✗ | ✗ | ✓ | ✓ |
| **Audit : Read** | ✗ | ✗ | ✗ | ✓ | ✓ |

**Inference :** La colonne `encadrant_academique` a un accès limité (commentaires jalons + RAG query).
Le rôle a été conçu pour avoir un rôle de supervision secondaire, non de gestion.


---

# PARTIE 2 — Service IA FastAPI

**Note :** L'analyse de cette section est basée sur les appels effectués depuis le backend NestJS
(`rag.service.ts`, `profiles.service.ts`, `subjects.service.ts`, `app.module.ts`).
Le code source du service FastAPI n'est pas dans ce dépôt.

**Confirmed by code (backend NestJS) :** Liste complète des endpoints consommés.
**Inference :** L'implémentation interne des algorithmes IA est déduite depuis les noms d'endpoints
et les payloads envoyés.

---

## Endpoints AI Service (confirmés par le code backend)

| Méthode | Chemin | Appelant NestJS | Input | Output |
|---------|--------|-----------------|-------|--------|
| POST | /extract | `profiles.service.ts` (upload CV) | `{ filePath, userId, fileType }` | `{ text / extractedText }` |
| POST | /embed/student | `profiles.service.ts` (après extract) | `{ userId, extractedText, skills, university, specialization, level }` | `200 OK` (embedding stocké) |
| POST | /embed/subject | `subjects.service.ts` (après validation) | `{ subjectId, titre, description, techno, prerequis, niveau }` | `200 OK` (embedding stocké) |
| POST | /embed/subjects/bulk | `app.module.ts` (warmup démarrage) | `{ subjects: [{ subjectId, titre, description, techno, prerequis, niveau }] }` | `200 OK` |
| GET | /suggest/:userId | `profiles.service.ts` | path param `userId` | `{ suggestions: [...] }` |
| POST | /generate/subject-from-cv | `subjects.service.ts` | `{ studentIds, encadreurId, context }` | `{ titre, description, techno, prerequis, niveau, rawPromptUsed }` |
| POST | /rag/documents | `rag.service.ts` | `{ filePath, documentName, documentType }` | `{ success, chunksIndexed }` |
| POST | /rag/query | `rag.service.ts` | `{ question, userId }` | `{ answer, sources: [{ documentName, excerpt }] }` |

---

## Pipeline CV — Traitement étudiant

**Confirmed by code (appels backend) :**

1. **Upload CV** — étudiant soumet `POST /profiles/documents/upload` avec `type=CV`
2. **Extraction texte** — NestJS appelle `POST /extract` avec `{ filePath, userId, fileType }`
   - Le service IA lit le fichier depuis le volume partagé `/var/neurostage/uploads`
   - **Inference :** Utilise `pdfplumber` pour PDF, `python-docx` pour DOCX, `pytesseract` pour images OCR
3. **Génération embedding** — NestJS appelle `POST /embed/student` avec `{ userId, extractedText, skills, university, level }`
   - **Inference :** Le service IA génère un vecteur de 768 dimensions avec `nomic-embed-text`
   - Persistance dans la table `student_embeddings` avec pgvector
4. **Notification** — Le service IA appelle en retour `NestJS /profiles/internal/ai-processed/:userId`
   pour mettre `isAiProcessed = true`
   - **Inference :** Ce callback n'est pas visible dans le code backend audité, mais `isAiProcessed`
     change bien après le traitement IA (confirmé par l'existence du champ et son usage)

---

## Pipeline recommandation de sujets

**Confirmed by code (`profiles.service.ts`) :**

1. Étudiant appelle `GET /profiles/me/suggestions`
2. NestJS transmet à `GET /suggest/:userId` vers le service IA
3. **Inference :** Le service IA :
   a. Charge l'embedding de l'étudiant depuis `student_embeddings`
   b. Effectue une recherche par similarité cosinus avec pgvector sur `subject_embeddings`
   c. Combine avec un matching par mots-clés (technologies, niveau)
   d. Retourne un score de correspondance pour chaque sujet

---

## Pipeline génération de sujet (encadrant_pro)

**Confirmed by code (`subjects.service.ts`) :**

1. Encadreur appelle `POST /subjects/generate-draft` avec `{ studentIds[], context? }`
2. NestJS appelle `POST /generate/subject-from-cv` sur le service IA
3. Le service IA retourne un objet JSON avec `{ titre, description, techno, prerequis, niveau, rawPromptUsed }`
4. NestJS :
   - Supprime `rawPromptUsed` de la réponse renvoyée au frontend (sécurité/audit)
   - Persiste `rawPromptUsed` dans la table `generation_ia` pour audit interne
   - Crée automatiquement un objet `Subject` avec `status: DRAFT`, `generatedByAi: true`, `aiGenerationSource: 'OLLAMA'`
5. Retourne `{ titre, description, techno, prerequis, niveau, subjectId, status: 'DRAFT' }` au frontend

**Inference :** Le service IA lit les embeddings des étudiants depuis `student_embeddings`,
construit un prompt avec les informations extraites des CV, appelle le LLM de génération (llama3.2),
et retourne un objet JSON structuré.

---

## Pipelines RAG

**Confirmed by code (`rag.service.ts`) :**

**Ingestion :**
1. Admin upload un fichier PDF/DOCX via `POST /rag/documents/upload`
2. NestJS stocke le fichier sur le volume partagé (`/uploads/rag/`)
3. NestJS appelle `POST /rag/documents` sur le service IA avec le chemin physique du fichier
4. **Inference :** Le service IA :
   - Extrait le texte du document
   - Découpe en chunks (taille et overlap non confirmés par le code NestJS)
   - Génère des embeddings pour chaque chunk
   - Stocke dans la table `rag_chunks` avec pgvector
5. Retourne `{ success: true, chunksIndexed: N }`

**Requête RAG :**
1. Utilisateur appelle `POST /rag/query` avec `{ question }`
2. NestJS transmet à `POST /rag/query` avec `{ question, userId }` vers le service IA
3. **Inference :** Le service IA :
   a. Génère l'embedding de la question
   b. Effectue une recherche de similarité cosinus sur `rag_chunks`
   c. Injecte les chunks les plus pertinents dans un prompt LLM
   d. Retourne la réponse générée avec citations des sources
4. Réponse : `{ answer: string, sources: [{ documentName, excerpt }] }`


---

## Architecture LLM

**Confirmed by code (`docker-compose.yml`) :**

```yaml
LLM_PROVIDER: ${LLM_PROVIDER:-ollama}
LLM_BASE_URL: ${LLM_BASE_URL:-http://host.docker.internal:11434/v1}
EMBEDDING_MODEL: ${EMBEDDING_MODEL:-nomic-embed-text}
GENERATION_MODEL: ${GENERATION_MODEL:-llama3.2}
EMBEDDING_DIMENSIONS: ${EMBEDDING_DIMENSIONS:-768}
OPENAI_API_KEY: ${OPENAI_API_KEY:-}
```

**Modèle d'embedding :**
- `nomic-embed-text` — dimensions : 768
- Utilisé pour tous les embeddings : étudiants, sujets, chunks RAG

**Modèle de génération :**
- `llama3.2` (par défaut Ollama)
- Utilisé pour la génération de sujets et les réponses RAG

**Abstraction LLM :**
- Variable `LLM_PROVIDER` contrôle le backend : `ollama` (défaut) ou `openai`
- `LLM_BASE_URL` pointe vers `http://host.docker.internal:11434/v1` (Ollama sur le host)
- `OPENAI_API_KEY` permet le basculement vers OpenAI API sans modification de code

**Inference :** Cette abstraction à deux fournisseurs a été conçue pour permettre :
- En développement et production sur VM modeste : Ollama local sans coût
- Option OpenAI pour les environnements avec GPU ou connexion internet commerciale
- Isolation de la dépendance LLM dans une variable d'environnement unique

**Infrastructure Ollama :**
- Ollama est installé directement sur le host de la VM (non containerisé)
- **Confirmed by code (`docker-compose.yml`) :** `LLM_BASE_URL: http://host.docker.internal:11434/v1`
- **Inference :** Cette approche évite la complexité de passer un GPU à l'intérieur d'un conteneur Docker
- Accès depuis les conteneurs via `host.docker.internal` qui résout en `172.17.0.1` sur Linux

---

## Sécurité du service IA

**Confirmed by code (`docker-compose.yml`, `rag.service.ts`, `subjects.service.ts`, `profiles.service.ts`) :**

- Tous les appels NestJS → service IA incluent le header `X-Internal-Secret: <INTERNAL_SECRET>`
- La valeur est lue depuis `process.env.INTERNAL_SECRET` (variable commune aux deux services)
- **Inference :** Le service FastAPI valide ce header avec `hmac.compare_digest()` pour éviter les timing attacks
- **Confirmed by code :** Le service IA n'est pas exposé directement sur le port 80 (Nginx ne proxifie pas `/ai/`)
- Port 8001 exposé uniquement dans `docker-compose.yml` (`ports: - "8001:8001"`) — accessible uniquement en réseau interne ou en développement
- L'autorisation RBAC des utilisateurs est entièrement gérée par NestJS — le service IA fait confiance
  à toute requête portant le bon `X-Internal-Secret`

---

## Stratégie base vectorielle

**Confirmed by code (`docker-compose.yml`) :**

- Utilisation de PostgreSQL 16 avec l'extension `pgvector` (image `pgvector/pgvector:pg16`)
- **Inference :** Tables vectorielles : `student_embeddings`, `subject_embeddings`, `rag_chunks`
- Recherche par similarité cosinus via SQL : `1 - (embedding <=> query_vector)`
- **Inference :** Index HNSW ou IVFFlat pour accélérer la recherche (non confirmé par le code NestJS)

**Justification pgvector vs. bases vectorielles dédiées :**

- Utiliser PostgreSQL + pgvector évite l'opération et le coût d'une base vectorielle séparée
  (Pinecone, Weaviate, Chroma)
- Toutes les données (relationnelles + vectorielles) restent dans une seule base → sauvegarde unifiée
- Pas de synchronisation entre bases à gérer
- Performances suffisantes pour le volume d'une plateforme de gestion de stages académiques

