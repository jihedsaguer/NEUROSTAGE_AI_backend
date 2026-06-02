# Implementation Plan: Jalons & Livrables

## Overview

Implémentation du module `jalons-livrables` en NestJS + TypeORM + PostgreSQL. Chaque tâche s'appuie sur la précédente et aboutit à un module entièrement câblé dans `AppModule`.

Langage : **TypeScript** (NestJS)  
Tests de propriétés : **`@fast-check/jest`**

---

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1. Créer les entités TypeORM et la migration de base de données"]
    },
    {
      "wave": 2,
      "tasks": ["2. Créer les DTOs et interfaces de réponse"]
    },
    {
      "wave": 3,
      "tasks": ["3. Implémenter `JalonsService` — gestion des jalons (CRUD admin)"]
    },
    {
      "wave": 4,
      "tasks": ["4. Implémenter `JalonsService` — consultation et calcul LATE"]
    },
    {
      "wave": 5,
      "tasks": ["5. Checkpoint — Vérifier que tous les tests passent", "6. Implémenter `JalonsService` — soumission de livrable"]
    },
    {
      "wave": 6,
      "tasks": ["7. Implémenter `JalonsService` — validation et commentaires"]
    },
    {
      "wave": 7,
      "tasks": ["8. Créer `JalonsController` et câbler le module"]
    },
    {
      "wave": 8,
      "tasks": ["9. Checkpoint final — Vérifier que tous les tests passent"]
    }
  ]
}
```

---

## Tasks

- [x] 1. Créer les entités TypeORM et la migration de base de données
  - Créer `src/modules/jalons/entities/jalon.entity.ts` avec l'enum `JalonStatus` et tous les champs décrits dans la conception
  - Créer `src/modules/jalons/entities/livrable.entity.ts` avec `select: false` sur le champ `hash`
  - Ajouter l'index composite `UNIQUE(stage_id, order)` sur `Jalon`
  - Ajouter la contrainte `unique: true` sur `jalonId` dans `Livrable`
  - _Exigences : 1.3, 1.4, 3.5, 7.1, 7.3_

- [x] 2. Créer les DTOs et interfaces de réponse
  - [x] 2.1 Créer `src/modules/jalons/dto/create-jalon.dto.ts` avec validation `class-validator`
    - Champs obligatoires : `stageId`, `label`, `dueDate`, `order`
    - Champ optionnel : `description`
    - _Exigences : 1.3_
  - [x] 2.2 Créer `src/modules/jalons/dto/update-jalon.dto.ts` (tous champs optionnels via `PartialType`)
    - _Exigences : 1.5_
  - [x] 2.3 Créer `src/modules/jalons/dto/validate-jalon.dto.ts`
    - Champs : `action: 'VALIDATE' | 'REJECT'`, `proComment?: string`
    - _Exigences : 4.5, 4.6, 4.7_
  - [x] 2.4 Créer `src/modules/jalons/dto/acad-comment.dto.ts`
    - Champ : `acadComment: string`
    - _Exigences : 5.3_
  - [x] 2.5 Créer `src/modules/jalons/dto/submit-livrable.dto.ts`
    - Champs : `fileName`, `fileUrl`, `fileType`, `size`, `hash`, `studentNote?`
    - _Exigences : 3.5_
  - [x] 2.6 Créer `src/modules/jalons/dto/jalon-response.dto.ts` et `livrable-response.dto.ts`
    - `hash` exclu de `LivrableResponseDto`
    - _Exigences : 3.8, 7.4_

- [x] 3. Implémenter `JalonsService` — gestion des jalons (CRUD admin)
  - [x] 3.1 Implémenter `createJalon(dto, user)` dans `src/modules/jalons/jalons.service.ts`
    - Vérifier que le stage existe et a le statut `ACTIVE`
    - Vérifier l'unicité de `order` dans le stage
    - Persister le jalon avec statut initial `PENDING`
    - _Exigences : 1.1, 1.2, 1.3, 1.4_
  - [ ]* 3.2 Écrire le test de propriété pour `createJalon`
    - **Propriété 1 : Création de jalon uniquement sur stage ACTIVE**
    - **Valide : Exigences 1.1, 1.2**
  - [ ]* 3.3 Écrire le test de propriété pour l'unicité de l'order
    - **Propriété 3 : Unicité de l'order par stage**
    - **Valide : Exigence 1.4**
  - [x] 3.4 Implémenter `updateJalon(id, dto, user)` — mise à jour si statut `PENDING`
    - _Exigences : 1.5, 1.6_
  - [x] 3.5 Implémenter `deleteJalon(id, user)` — suppression si statut `PENDING`
    - _Exigences : 1.7, 1.8_
  - [ ]* 3.6 Écrire le test de propriété pour modification/suppression
    - **Propriété 4 : Modification et suppression uniquement si PENDING**
    - **Valide : Exigences 1.5, 1.6, 1.7, 1.8**

- [x] 4. Implémenter `JalonsService` — consultation et calcul LATE
  - [x] 4.1 Implémenter `getJalonsForStage(stageId, user)` avec scoping par rôle
    - Vérifier l'appartenance au stage selon le rôle de l'utilisateur
    - Appliquer le calcul dynamique du statut `LATE`
    - _Exigences : 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 6.1, 6.2_
  - [x] 4.2 Implémenter `getJalonById(id, user)` avec livrable inclus et calcul LATE
    - _Exigences : 2.7, 6.1, 6.2_
  - [x] 4.3 Extraire une méthode privée `computeStatus(jalon)` pour le calcul LATE
    - Retourne `LATE` si `dueDate < now && status IN (PENDING, SUBMITTED)`, sinon retourne le statut persisté
    - _Exigences : 6.1, 6.2_
  - [ ]* 4.4 Écrire le test de propriété pour le scoping par rôle
    - **Propriété 5 : Scoping des jalons par rôle**
    - **Valide : Exigences 2.1–2.6**
  - [ ]* 4.5 Écrire le test de propriété pour le calcul LATE
    - **Propriété 14 : Calcul dynamique du statut LATE**
    - **Valide : Exigences 6.1, 6.2**
  - [ ]* 4.6 Écrire le test de propriété pour l'idempotence de la lecture
    - **Propriété 15 : Lecture idempotente — pas de mutation du statut persisté**
    - **Valide : Exigence 6.2**
  - [ ]* 4.7 Écrire le test de propriété pour l'inclusion du livrable
    - **Propriété 6 : Livrable inclus dans la réponse si présent**
    - **Valide : Exigence 2.7**

- [x] 5. Checkpoint — Vérifier que tous les tests passent
  - S'assurer que tous les tests passent, poser des questions à l'utilisateur si nécessaire.

- [x] 6. Implémenter `JalonsService` — soumission de livrable
  - [x] 6.1 Implémenter `submitLivrable(jalonId, dto, user)` dans `jalons.service.ts`
    - Vérifier que le jalon appartient au stage de l'étudiant (`studentId === user.id`)
    - Vérifier que le statut est `PENDING` ou `REJECTED`
    - Upsert du livrable (remplacer si existant)
    - Mettre à jour le statut du jalon vers `SUBMITTED`
    - Initialiser `scanOk` à `false`
    - _Exigences : 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.9, 7.1, 7.2_
  - [x] 6.2 Implémenter `getLivrable(jalonId, user)` avec vérification d'accès scopé
    - _Exigences : 2.1–2.6_
  - [ ]* 6.3 Écrire le test de propriété pour les gardes d'accès à la soumission
    - **Propriété 7 : Soumission de livrable — garde d'accès et statut valide**
    - **Valide : Exigences 3.1, 3.2, 3.3, 3.4**
  - [ ]* 6.4 Écrire le test de propriété pour la transition de statut après soumission
    - **Propriété 8 : Transition de statut → SUBMITTED après soumission**
    - **Valide : Exigence 3.6**
  - [ ]* 6.5 Écrire le test de propriété pour l'unicité du livrable (re-soumission)
    - **Propriété 9 : Re-soumission remplace le livrable**
    - **Valide : Exigences 3.7, 7.1, 7.2**
  - [ ]* 6.6 Écrire le test de propriété pour l'exclusion du hash
    - **Propriété 10 : Hash jamais exposé dans les réponses API**
    - **Valide : Exigences 3.8, 7.4**

- [x] 7. Implémenter `JalonsService` — validation et commentaires
  - [x] 7.1 Implémenter `validateJalon(id, dto, user)` dans `jalons.service.ts`
    - Vérifier que `user.id === stage.encadrantProId`
    - Vérifier que le statut est `SUBMITTED`
    - Si `action === 'REJECT'`, exiger `proComment` non vide
    - Mettre à jour statut, `validatedBy`, `validatedAt`, `proComment`
    - _Exigences : 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_
  - [x] 7.2 Implémenter `addAcadComment(id, dto, user)` dans `jalons.service.ts`
    - Vérifier que `user.id === stage.encadrantAcadId`
    - Persister `acadComment` quel que soit le statut
    - _Exigences : 5.1, 5.2, 5.3, 5.4_
  - [ ]* 7.3 Écrire le test de propriété pour les gardes de validation/rejet
    - **Propriété 11 : Validation/rejet — garde d'accès et statut valide**
    - **Valide : Exigences 4.1, 4.2, 4.3, 4.4, 4.7**
  - [ ]* 7.4 Écrire le test de propriété pour la transition d'état après validation/rejet
    - **Propriété 12 : Transition d'état correcte après validation/rejet**
    - **Valide : Exigences 4.5, 4.6**
  - [ ]* 7.5 Écrire le test de propriété pour le commentaire académique
    - **Propriété 13 : Commentaire académique — garde d'accès et acceptation tous statuts**
    - **Valide : Exigences 5.1, 5.2, 5.3, 5.4**

- [x] 8. Créer `JalonsController` et câbler le module
  - [x] 8.1 Créer `src/modules/jalons/jalons.controller.ts` avec tous les endpoints définis dans la conception
    - Appliquer `JwtAuthGuard` et `RolesGuard` globalement sur le contrôleur
    - Appliquer `@Roles(...)` sur chaque endpoint selon les règles RBAC
    - Injecter `@Request() req` pour passer `req.user` au service
    - _Exigences : 1.1–7.4 (tous les endpoints)_
  - [x] 8.2 Créer `src/modules/jalons/jalons.module.ts`
    - Importer `TypeOrmModule.forFeature([Jalon, Livrable])`
    - Importer `StagesModule` (ou exporter `StageRepository` depuis `StagesModule`)
    - Déclarer `JalonsController` et `JalonsService`
  - [x] 8.3 Enregistrer `JalonsModule` dans `src/app.module.ts`
    - _Exigences : tous_

- [x] 9. Checkpoint final — Vérifier que tous les tests passent
  - S'assurer que tous les tests passent, poser des questions à l'utilisateur si nécessaire.

---

## Notes

- Les tâches marquées `*` sont optionnelles et peuvent être ignorées pour un MVP rapide
- Chaque tâche référence les exigences spécifiques pour la traçabilité
- Les tests de propriétés utilisent `@fast-check/jest` avec minimum 100 itérations
- Le champ `hash` doit être marqué `select: false` dans TypeORM et exclu de tous les DTOs de réponse
- Le statut `LATE` est calculé dynamiquement dans `computeStatus()` et n'est jamais persisté en base
- L'upsert du livrable doit utiliser `save()` avec l'entité existante pour respecter la contrainte d'unicité
