Cahier des Charges – NEUROSTAGE AI – Le Cerveau Intelligent de la Gestion des Stages
(PFE Ingénieur)
NEUROSTAGE AI est une plateforme intelligente de gestion des stages permettant de centraliser l’ensemble du cycle étudiant–encadreur–administration, depuis les sujets jusqu’à la soutenance, avec collaboration en temps réel et automatisation documentaire.
Elle intègre des modules IA avancés (matching, OCR CIN, RAG, Copilot 365), fonctionne en mode web, mobile, on premise ou Cloud SOTETEL, et garantit une traçabilité complète, une sécurité renforcée et une efficacité opérationnelle accrue.
PARTIE A — Vision & Périmètre
1. Objet & Périmètre
Fournir une application complète de gestion des stages couvrant : sujets → candidatures → affectations → jalons/livrables → soutenance. La solution fonctionne en **web (PWA)**, **mobile (Android/iOS)** et s’installe **sur serveurs SOTETEL (on‑prem)** ou **sur Cloud SOTETEL**. Les modules IA (matching, RAG), chat/fichiers, mailing, statistiques, attestations et vérification d’identité (CIN) sont inclus.
2. Contexte & Problématique
Les processus de stages sont fragmentés, peu traçables et lents. Problématique : centraliser et automatiser l’ensemble du cycle avec IA, collaboration en temps réel, génération documentaire, sécurité et industrialisation DevOps (Docker/CI‑CD).
3. Définitions & Abréviations
•	PWA : Progressive Web App
•	RAG : Retrieval‑Augmented Generation
•	RBAC : Role‑Based Access Control
•	MDM : Mobile Device Management
•	CI/CD : Intégration & Déploiement continus
PARTIE B — Gouvernance, Rôles & Accès
4. Rôles (RBAC) & Responsabilités
• Administrateur Système & Application & Maintenance: Super‑admin technique : environnements, déploiements, sauvegardes, supervision, sécurité, clés/API, webhooks n8n, intégrations (Copilot/ChatGPT), antivirus, stockage, logs.
• Administrateur – Responsable Service Formation & Stages (SOTETEL): Admin métier : promotions/étudiants/encadreurs, publication/validation de sujets, modèles, jalons, notation, reporting/KPI.
• Encadreur Professionnel (SOTETEL): Création/édition de sujets, suivi étudiants, chat, commentaires, validations jalons, évaluations, dépôt/consultation de documents.
• Encadreur Académique (École): Visualisation des étudiants dont il est tuteur + commentaires (pas de modification), accès chat avec ses étudiants.
• Étudiant: Profil, upload CV/relevés/certificats/captures, candidatures, suivi jalons, chat, dépôt livrables, consultation documents générés (convention, fiche hebdo, PV).
5. Authentification, domaines autorisés & MFA
Connexion par email/mot de passe **ou** OIDC (Microsoft/Google) avec vérification d’email. Politiques de mot de passe, **2FA (TOTP/email)**, verrouillage après tentatives.
**Allowlist domaines** : @sotetel.tn, @gmail.com, @aol.com, @aol.fr, @outlook.fr, @hotmail.com, @hotmail.fr (standardisation : ‘hotmail’, et non ‘hotmaol’).
6. Matrice des permissions (extrait)
•	Utilisateurs — Admin Système: C/R/U/D | Admin Formation: C/R/U | Encadreur Pro: – | Encadreur Acad.: – | Étudiant: –
•	Sujets — Admin Système: C/R/U/D | Admin Formation: C/R/U/D | Encadreur Pro: C/R/U/D (ses sujets) | Encadreur Acad.: R | Étudiant: C (proposer)
•	Candidatures & Affectations — Admin Système: R/U | Admin Formation: C/R/U/D | Encadreur Pro: R/U (ses sujets) | Encadreur Acad.: R | Étudiant: C/R (ses dossiers)
•	Jalons & Livrables — Admin Système: R/U | Admin Formation: C/R/U/D | Encadreur Pro: C/R/U (étudiants suivis) | Encadreur Acad.: R + commenter | Étudiant: C/R
•	Évaluations/Notes — Admin Système: R/U | Admin Formation: C/R/U/D | Encadreur Pro: C/R/U (rubriques pro) | Encadreur Acad.: R + commenter | Étudiant: R
•	Documents — Admin Système: R/U | Admin Formation: C/R/U/D | Encadreur Pro: C/R/U (étudiants suivis) | Encadreur Acad.: R | Étudiant: R (personnels)
•	Chat — Admin Système: modération | Admin Formation: C/R | Encadreur Pro: C/R (étudiants suivis) | Encadreur Acad.: C/R | Étudiant: C/R
•	Paramètres IA (matching/RAG) — Admin Système: C/R/U | Admin Formation: R | Autres: –
PARTIE C — Exigences Fonctionnelles
7. Modules Fonctionnels
• Catalogue des sujets: Fiches sujet, filtres, recherche.
• Candidatures & Affectations: Workflow candidature → shortlist → entretien → affectation avec piste d’audit.
• Jalons & Livrables: Planning hebdomadaire, validations, commentaires académiques, check‑lists BE/DAO.
• Documents & signatures: Modèles DOCX/PDF : convention, fiche hebdo, PV, CDC; signature simple; versioning.
• Chat & Partage de fichiers: Threads, mentions @, upload images/PDF/DOCX/ZIP, antivirus, prévisualisation, recherche, notifications.
• Mailing & Notifications: SMTP O365/Gmail, listes, templates HTML, relances automatiques n8n, SPF/DKIM/DMARC.
• IA — Matching: Ingestion CV/relevés/certificats/captures (OCR), embeddings + FAISS, scoring cosinus pondéré, explicabilité.
• IA — RAG: Recherche contextuelle conventions/procédures avec citations.
• Statistiques & Analytiques: Universités, branches, niveaux, encadreurs, KPI, prédictif, exports PDF/CSV.
• Universités & Branches: CRUD universités, filières, import/export CSV/Excel, rattachements.
• Activités & Journalisation: Piste d’audit complète, historique étudiant, alertes délais/retards/anomalies IA.
• Attestations & Officiels: Attestation fin de stage, présence, assiduité, contribution, atelier; QR optionnel; templates DOCX + PDF.
• Tableaux de bord Encadreurs: Pro & Acad : charge, délais, retards, activité mensuelle.
8. Données & Schéma (extrait)
•	User(id, role, email, competences[], certificats[], cv_url, releves_url)
•	Sujet(id, titre, description, techno[], niveau, prerequis, createur_id, statut)
•	Candidature(id, user_id, sujet_id, score_match, statut, commentaires)
•	Stage(id, sujet_id, etudiant_id, encadrant_pro_id, encadrant_acad_id, date_deb, date_fin, etat)
•	Jalon(id, stage_id, libelle, echeance, statut, livrable_url, validation_par)
•	Evaluation(id, stage_id, rubriques_json, note_finale)
•	MessageChat(id, stage_id, auteur_id, contenu, pieces[], horodatage, statut_lu)
•	PieceJointe(id, message_id, nom, type, taille, url, hash, scan_ok)
•	ProfilIA(user_id, competences[], certifs[], embeddings)
•	SujetIndex(sujet_id, techno[], embeddings)
•	ModeleDocument(id, type, stockage_url, version, dernier_auteur)
•	GenerationIA(id, type, prompt, sorties_url, horodatage, valide_par, version)
PARTIE D — Exigences Techniques & Architecture
9. Architecture cible
• Frontend: React + Redux, Tailwind/Bootstrap, TypeScript (optionnel), **PWA** (cache offline basique, accès caméra pour CIN).
• Mobile: **React Native** (prioritaire) ou Flutter; packaging Android (.apk/.aab) & iOS (.ipa via MDM/TestFlight); push FCM/APNs; mode offline brouillons.
• Backend: Node.js (NestJS/Express) ou Python (Django/DRF); REST (+ GraphQL optionnel).
• IA: LangChain + FAISS/pgvector; OpenAI API; OCR **Tesseract** self‑host pour CIN.
• Base de données: PostgreSQL (ou MongoDB si MERN strict).
• Automations: n8n (emails, relances, génération docs, webhooks).
• DevOps: Docker, Nginx, GitHub Actions CI/CD; monitoring & logs centralisés.
10. Cibles d’installation & distribution
10.1 Web (navigateur + PWA)
•	Responsive (desktop/tablette/mobile)
•	Manifest + Service Worker
•	Accès caméra (capture CIN)
•	Notifications Web (si autorisées)
10.2 Mobile (Android/iOS)
•	Technologie : **React Native** (recommandée)
•	Distribution : **MDM SOTETEL** interne ou Stores (Play Store/TestFlight)
•	Fonctions : push, accès caméra, upload multi‑fichiers
•	Offline : cache écrans + brouillons
10.3 Installation sur serveurs SOTETEL (on‑prem)
•	Environnements : DEV / RECETTE / PROD
•	Packaging : **Docker Compose** (MVP) + option **Helm/Kubernetes**
•	Sizing (MVP) : App 4 vCPU/8 Go; DB 4 vCPU/16 Go; stockage 200 Go (docs)
•	Réseau/Ports : 80/443 (Nginx), 5432 (PostgreSQL), 3000/8000 (apps)
•	DNS interne : stageflow.sotetel.tn; certificats TLS
•	Sécurité : pare‑feu, sauvegardes quotidiennes, rétention 30 j
•	PRA : RPO 24h, RTO 4h (MVP)
•	Supervision : métriques + logs, alertes e‑mail/Teams
•	SSO/OIDC : Azure AD ou IdP interne
10.4 Option Cloud SOTETEL & Intégration Copilot 365
•	VM Linux (Ubuntu/Debian), Docker/Podman/Kubernetes interne
•	Stockage objet **MinIO/Ceph** ou NAS; PostgreSQL interne
•	Reverse proxy Nginx + TLS; SMTP interne
•	Monitoring Grafana/Prometheus; logs centralisés
•	**Copilot 365** : génération automatique de documents (conventions, PV, CDC, attestations) depuis modèles SharePoint/OneDrive; synthèses & rapports
•	API Microsoft Graph & gouvernance accès (optionnel)
11. Sécurité & Protection des données
•	Auth **JWT/OIDC**, **RBAC**, audit log
•	OWASP Top 10, rate limiting, headers sécurité
•	TLS 1.2+ en transit; chiffrement au repos (S3/NAS)
•	Antivirus sur upload, quotas, rétention & purge
•	RGPD : consentements, export/suppression, anonymisation
12. Module Vérification d’Identité (CIN)
Objectif. Lecture IA/OCR de la CIN à l’inscription depuis image (photo/scan), avec **stockage uniquement des 3 derniers chiffres en clair** (ex. ******123) et **empreinte (hash) non réversible** du numéro complet (optionnelle, activée par défaut) pour antifraude.
12.1 Portée & périmètre
•	Upload image CIN → OCR (Tesseract)
•	Détection motif CIN (regex), contrôle de cohérence
•	Affichage masqué ******XYZ pour confirmation
•	Stockage : 3 derniers chiffres (clairs) + hash(CIN+sel) optionnel
•	Journalisation sans numéro complet en clair
12.2 Flux de traitement
1.	Upload (PNG/JPG) → scan antivirus & contrôle format
2.	OCR → texte brut
3.	Parsing → extraction CIN + contrôles
4.	Masquage & confirmation utilisateur
5.	Stockage XYZ + hash (si activé)
6.	Consentement enregistré (horodatage, version texte)
7.	Purge auto images ≤ 7 jours (paramétrable)
12.3 Exigences techniques & sécurité
•	OCR self‑host (Tesseract), pas de CIN complète vers l’extérieur
•	SHA‑256 + sel unique; colonnes séparées
•	HTTPS, RBAC restreint (seuls Admin Système & Admin Formation voient XYZ)
•	OWASP Top 10; chiffrement des fichiers temporaires; purge planifiée (n8n/cron)
12.4 Exigences fonctionnelles
•	UI inscription : drag‑&‑drop + capture mobile; consentement explicite
•	Échec OCR → saisie manuelle assistée (masquée)
•	Accessibilité FR/AR/EN (optionnel)
12.5 Critères d’acceptation
•	Jamais de stockage du numéro complet en clair
•	Suppression images ≤ 7 jours
•	Taux de détection OCR > 95% (jeu varié)
•	0 critique aux scans OWASP ZAP
•	Traçabilité consentements (horodatage, IP, version)
12.6 API (exemples)
•	POST /idcheck/cin/upload → upload, antivirus, OCR, retour ******XYZ
•	POST /idcheck/cin/confirm → sauvegarde XYZ + hash + consentement
•	GET /admin/cin/:userId → ******XYZ + métadonnées (jamais la CIN complète)
12.7 Mentions légales (résumé)
•	Minimisation : 3 derniers chiffres uniquement
•	Finalité : vérification identité & antifraude
•	Base légale : consentement explicite + intérêt légitime
•	Droits : accès/suppression/rectification; DPO SOTETEL (à préciser)
12.8 Messages UI & Écrans (Mocks)
•	Consentement : ‘En téléversant votre CIN, vous consentez au traitement partiel (3 derniers chiffres)…’
•	Erreurs OCR : ‘Image floue ou trop sombre…’, ‘Format non supporté (JPG/PNG)…’
•	Exemples masquage : ******123, ******987
[ Écran d'inscription ]
Nom, Email, Téléverser CIN (Glisser‑déposer / Parcourir)
Message : ‘Votre CIN sera traitée par IA…’
[ Continuer ]
[ Écran Upload CIN ]
Preview image
‘OCR en cours…’
‘Vérification en cours, merci de patienter…’
[ Écran Confirmation ]
Numéro détecté : ******123
Confirmer ?  [ Oui ]  [ Non, réessayer ]
PARTIE E — Pilotage (User stories, KPI, Planning, Livrables)
13. User stories & Critères d’acceptation (extraits)
•	Comptes & rôles — création encadreur via email autorisé; CA : invitation 72h, domaine allowlist
•	Chat & pièces jointes — échanges PDF/DOCX; CA : antivirus, prévisualisation, horodatage, téléchargement
•	IA Matching — top‑5 recommandé en < 2,5 s (corpus ≤ 200)
•	IA CDC — DOCX corporate, champs auto, sections ‘À valider’
14. KPI & Critères de validation
•	Taux d’affectation < 7 jours
•	Satisfaction ≥ 4/5
•	Disponibilité ≥ 99,5% (MVP)
•	0 critique OWASP en prod
•	Précision matching ≥ 80% (jeu annoté)
15. Planning — 6 mois (24 semaines)
M1 – Analyse & Conception
•	S1–S2 : Analyse besoins, SFD v1, UML
•	S3–S4 : Architecture MERN/IA/DevOps, BD, Maquettes UI
M2 – Backend & Modules cœur
•	S5–S6 : Auth, rôles, domaines email
•	S7–S8 : Sujets, Candidatures, workflow affectation
M3 – Chat, Fichiers, Jalons, n8n
•	S9–S10 : Chat temps réel, fichiers + antivirus
•	S11–S12 : Jalons hebdo, notifications n8n
M4 – IA OCR / Matching / RAG
•	S13–S14 : OCR CIN (3 chiffres), hash optionnel
•	S15–S16 : Matching IA + RAG
M5 – Documents & Statistiques
•	S17–S18 : Génération DOCX/PDF
•	S19–S20 : Statistiques, Dashboards
M6 – Sécurité, CI/CD, Soutenance
•	S21–S22 : Sécurité OWASP, CI/CD
•	S23–S24 : Rapport, vidéo, présentation
Annexe A — Planning 16 semaines (version initiale)
•	S1‑S2 : Cadrage, SFD, maquettes (incl. chat & e‑mails)
•	S3‑S6 : Comptes, RBAC, Sujets, Candidatures
•	S7‑S8 : Chat (fichiers), Mailing, Notifications
•	S9‑S11 : IA Matching + OCR captures + RAG
•	S12 : Génération DOCX (Copilot/ChatGPT) + n8n
•	S13‑S14 : Sécurité, tests E2E, perf
•	S15‑S16 : Docs, vidéo, soutenance
16. Livrables
•	SFD + UML + maquettes Figma
•	Schéma BD + scripts init
•	Code front/back + Docker Compose (MVP) + Helm chart (option)
•	APK Android (React Native) + paquet iOS (MDM/TestFlight) + PWA
•	CI/CD (pipelines) + documentation d’installation on‑prem/cloud
•	Journal de tests + rapports sécurité (OWASP ZAP)
•	Modèles DOCX + PDF (convention, PV, attestations, CDC)
