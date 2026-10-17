# ntDéploiement sur Vercel

Ce document couvre la mise en production sur Vercel : configuration du
projet, variables d'environnement, services tiers à provisionner et étapes
post-déploiement. Il ne documente pas une fonctionnalité retirable (pas de
`retrait.md`) : c'est un guide d'exploitation.

## Vue d'ensemble

Le projet est déjà câblé pour Vercel :

- `svelte.config.js` utilise `@sveltejs/adapter-vercel` (`runtime: 'nodejs20.x'`,
  `memory: 1024`, `maxDuration: 30`) — build/preset détectés automatiquement,
  rien à choisir manuellement dans les réglages Vercel du projet.
- `vercel.json` déclare deux Cron Jobs (`/api/jobs/cleanup` quotidien,
  `/api/jobs/cart-recovery` toutes les 30 min) — **voir la limite du plan
  Hobby ci-dessous, elle bloque le déploiement tel quel.**
- `postinstall` (`package.json`) exécute `prisma generate` et copie les
  assets TinyMCE : aucune étape manuelle nécessaire pour ces deux points au
  build.
- La CSP (`svelte.config.js` → `kit.csp`) est **bloquante** (`directives`,
  plus `reportOnly`) depuis l'audit statique du code (domaines externes
  réellement appelés côté navigateur). `/api/csp-report` reste actif comme
  canari — voir section dédiée en bas de page pour le détail des directives
  et le smoke-test à refaire après chaque ajout de service tiers côté client.

## Checklist de provisioning initial (un e-mail, tous les comptes, dans l'ordre)

À suivre une seule fois, lors de la création d'une nouvelle instance
(nouveau client/nouvel environnement). Ordonnée pour minimiser les
allers-retours : les étapes lentes à valider sont lancées en premier, et les
services qui ont besoin d'une URL publique (webhooks, redirect URI) arrivent
après que Vercel en ait fourni une.

**Phase 0 — identité (bloque tout le reste)**

- [ ] Créer l'adresse e-mail dédiée au projet (pas une boîte perso) — c'est
      l'identité utilisée pour **chaque** inscription ci-dessous ;
      centralise la propriété et la récupération de compte. Activer 2FA +
      gestionnaire de mots de passe dessus avant de l'utiliser : elle
      devient un point de défaillance unique pour tous les services tiers.
- [ ] Réserver le nom de domaine (si pas déjà fait), chez n'importe quel
      registrar — nécessaire plus loin pour l'authentification SMTP
      (SPF/DKIM Brevo), le domaine custom Vercel, et des redirect URI
      stables (Google OAuth).
- [ ] Créer le compte GitHub (avec l'adresse e-mail de la Phase 0) s'il
      n'existe pas déjà, puis y créer le dépôt et y pousser le code —
      prérequis à l'import du projet dans Vercel (Phase 2), qui se connecte
      nativement à GitHub pour déployer à chaque push.

**Phase 1 — à lancer immédiatement (vérifications lentes, pas bloquantes pour le reste)**

- [ ] **Sendcloud** : inscription avec l'adresse e-mail, démarrer la
      vérification business tout de suite (peut prendre plusieurs jours) —
      le reste du provisioning peut continuer en parallèle sans l'attendre.
- [ ] **Stripe** : inscription avec l'adresse e-mail, démarrer la
      vérification entreprise (nécessaire pour passer en mode live) — le
      mode test (`sk_test_...`) fonctionne immédiatement sans attendre
      cette validation, donc ne bloque pas le développement/Preview.

**Phase 2 — infra cœur (fournit l'URL publique nécessaire à la Phase 3)**

- [ ] **Vercel** : inscription avec l'adresse e-mail (ou connexion via
      GitHub), puis **Import Project** depuis le dépôt → donne
      immédiatement une URL `*.vercel.app` utilisable comme callback/webhook
      temporaire pour tous les services de la Phase 3, avant même d'avoir
      branché le domaine custom.
- [ ] **Neon** : inscription, création du projet → branche `production`
      (par défaut) + branche `preview`/`dev` (voir
      [section dédiée ci-dessus](#s%C3%A9parer-production-preview-et-d%C3%A9veloppement--branches-neon))
      → récupérer les connexions pooler/directe des deux branches.

**Phase 3 — services tiers (indépendants entre eux, après la Phase 2 pour avoir une URL à renseigner)**

- [ ] **Cloudinary** : inscription, récupérer cloud name/clé/secret.
- [ ] **Brevo** : inscription, récupérer les identifiants SMTP, lancer la
      vérification SPF/DKIM/DMARC du domaine réservé en Phase 0 (peut aussi
      prendre du temps à se propager en DNS).
- [ ] **Google Cloud Console** : créer le projet, l'écran de consentement
      OAuth, puis les identifiants — redirect URI = URL Vercel obtenue en
      Phase 2 (à mettre à jour plus tard si le domaine custom change l'URL
      finale).
- [ ] **Upstash** : inscription, créer la base Redis puis QStash.
- [ ] **Sentry** : inscription, créer le projet JavaScript/SvelteKit.
- [ ] **TinyMCE Cloud** : inscription, récupérer la clé API gratuite.

**Phase 4 — câblage**

- [ ] Reporter toutes les clés obtenues dans Vercel → Environment Variables
      (dashboard ou CLI, voir
      [section dédiée ci-dessus](#cr%C3%A9er-et-partager-les-variables-en-%C3%A9quipe-dashboard-vs-cli)),
      bien scopées par environnement (Production vs Preview/Development —
      clés Stripe/test vs live en particulier).
- [ ] `npx prisma migrate deploy` contre la branche `production` Neon.
- [ ] Si le domaine custom (Phase 0) est prêt : le brancher dans Vercel →
      Project Settings → Domains, puis **mettre à jour** `APP_URL`, le
      redirect URI Google, et les webhooks Stripe/Sendcloud pour pointer
      l'URL définitive plutôt que l'URL `*.vercel.app` temporaire utilisée
      en Phase 3.

**Phase 5 — vérification**

- [ ] Reprendre la [Checklist post-déploiement](#checklist-post-d%C3%A9ploiement)
      plus bas dans ce document (smoke test complet, schedules QStash,
      modules optionnels à activer).

## Variables d'environnement

Base complète et commentée : [.env.example](../../.env.example). À reporter
dans Vercel → Project Settings → Environment Variables, pour les
environnements **Production** et **Preview** (voir la nuance `APP_URL` /
`VERCEL_URL` plus bas — ne pas se contenter de Production seul si des
Preview Deployments doivent aussi fonctionner).

| Variable                                                 | Obligatoire             | Fournisseur | Rôle                                                                                                                                            |
| -------------------------------------------------------- | ----------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                           | oui                     | Neon        | connexion runtime, via le pooler (`-pooler`)                                                                                                    |
| `DIRECT_URL`                                             | oui                     | Neon        | connexion directe, requise par `prisma migrate`                                                                                                 |
| `BETTER_AUTH_SECRET`                                     | oui                     | —           | signature des cookies de session + chiffrement des secrets 2FA (Better Auth, voir [docs/auth](../auth/README.md))                               |
| `PUBLIC_ENV`                                             | oui                     | —           | `production` en prod                                                                                                                            |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`              | oui (si Google actif)   | Google      | OAuth — l'URI de redirection à autoriser dans Google Cloud Console est `<domaine>/api/auth/callback/google` (Better Auth, pas une route maison) |
| `STRIPE_SECRET_KEY`                                      | oui                     | Stripe      | paiements                                                                                                                                       |
| `STRIPE_WEBHOOK_SECRET`                                  | oui                     | Stripe      | signature `POST /api/webhooks`                                                                                                                  |
| `VITE_STRIPE_PUBLISHABLE_KEY`                            | oui                     | Stripe      | Stripe Elements / Checkout côté client                                                                                                          |
| `SENDCLOUD_BASE_URL`                                     | oui                     | Sendcloud   | fixe (`https://panel.sendcloud.sc`)                                                                                                             |
| `SENDCLOUD_PUBLIC_KEY` / `SENDCLOUD_SECRET_KEY`          | oui                     | Sendcloud   | API                                                                                                                                             |
| `SENDCLOUD_INTEGRATION_ID`                               | oui                     | Sendcloud   | intégration liée aux étiquettes                                                                                                                 |
| `SENDCLOUD_SENDER_ADDRESS_ID`                            | non (vestige)           | Sendcloud   | devenue inutile depuis la migration v3, voir [docs/commerce](../commerce/README.md) — aucun appel ne la consomme, zéro usage dans `src/`        |
| `SENDCLOUD_WEBHOOK_SECRET`                               | oui                     | Sendcloud   | signature `POST /api/webhooks/sendcloud`                                                                                                        |
| `VITE_SHOP_FROM_COUNTRY` / `VITE_SHOP_FROM_POSTAL`       | oui                     | —           | calcul des frais de port                                                                                                                        |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS`    | oui                     | Brevo       | e-mails transactionnels                                                                                                                         |
| `SMTP_FROM`                                              | non (valeur par défaut) | —           | adresse d'expéditeur affichée                                                                                                                   |
| `ACCOUNTING_EXPORT_EMAIL`                                | non (sinon job muet)    | —           | destinataire de l'export comptable mensuel (voir [docs/admin](../admin/README.md#export-comptable-automatis%C3%A9))                             |
| `DISPUTE_ALERT_EMAIL`                                    | non (sinon log seul)    | —           | destinataire de l'alerte litige Stripe (voir [docs/commerce](../commerce/README.md#litiges-stripe-chargebacks))                                 |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET`     | oui                     | Cloudinary  | upload/CDN images produits                                                                                                                      |
| `PUBLIC_TINYMCE_API_KEY`                                 | oui (si blog actif)     | TinyMCE     | éditeur riche `/admin/blog`                                                                                                                     |
| `SECRET_ADDRESS_SEARCH_MODE`                             | oui (`live` en prod)    | —           | `e2e` uniquement pour les tests, jamais en prod                                                                                                 |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN`                      | recommandé              | Upstash     | rate-limit/cache/verrous partagés entre instances                                                                                               |
| `QSTASH_TOKEN`                                           | recommandé              | Upstash     | file de jobs asynchrones                                                                                                                        |
| `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY` | avec QStash             | Upstash     | vérification des callbacks QStash                                                                                                               |
| `APP_URL`                                                | voir note ci-dessous    | —           | URL publique explicite (jobs, e-mails, callbacks QStash)                                                                                        |
| `CRON_SECRET`                                            | si pas de QStash        | —           | authentifie les requêtes Vercel Cron                                                                                                            |
| `SENTRY_DSN` / `PUBLIC_SENTRY_DSN`                       | recommandé              | Sentry      | erreurs + traces serveur/navigateur                                                                                                             |
| `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT`    | non (CI uniquement)     | Sentry      | upload des source maps, désactivé par défaut                                                                                                    |

### `APP_URL` vs `VERCEL_URL` — piège spécifique à Vercel

`resolveAppUrl()` (`src/lib/server/app-url.ts`, `src/lib/server/qstash.ts`)
utilise `APP_URL` en priorité, sinon `VERCEL_URL` (fourni automatiquement par
Vercel). `VERCEL_URL` change à chaque déploiement Preview (URL unique par
déploiement) : si QStash s'appuie dessus pour rappeler l'app (schedules ou
jobs enfilés), un ancien déploiement Preview supprimé ne répond plus, et un
schedule enregistré depuis un Preview ne pointera jamais le domaine de
Production. **Toujours définir** `APP_URL` explicitement sur l'environnement
Production, avec le domaine stable (custom domain ou `*.vercel.app` de
production) — ne pas compter sur `VERCEL_URL` en dehors des Previews.

Dépendent aussi de cette résolution (`resolveAppUrlOrDefault()`, repli
`http://localhost:2000` si ni l'une ni l'autre n'est définie) les liens
inclus dans les e-mails de sécurité du compte : alerte « nouvelle
connexion détectée », confirmation de changement de mot de passe, alerte
« tentatives de connexion échouées », et le lien de révocation à distance
« Ce n'était pas moi » (`$lib/server/newDeviceAlert.ts`,
`passwordChangedAlert.ts`, `failedLoginAlert.ts`). Un `APP_URL` absent en
Preview n'empêche rien de fonctionner (repli sur `VERCEL_URL`, toujours
fourni par Vercel), mais vérifier au moins une fois qu'un de ces e-mails
contient bien un lien cliquable vers le bon domaine avant la mise en
production réelle.

### Créer et partager les variables en équipe (dashboard vs CLI)

Deux façons équivalentes de renseigner les variables ci-dessus dans Vercel,
à combiner selon le besoin :

- **Dashboard** (Project → Settings → Environment Variables) : formulaire
  nom/valeur, avec **trois cases à cocher par variable** — `Production`,
  `Preview`, `Development`. Une même variable peut avoir une valeur
  différente par environnement (ex. `STRIPE_SECRET_KEY` en mode test pour
  Preview/Development, en mode live pour Production **seulement** — ne
  jamais cocher Production sur une clé de test, ni l'inverse). Historique
  des modifications visible dans l'onglet, mais pas d'audit trail par
  personne (voir la recommandation « gestionnaire de secrets dédié » dans
  [docs/secrets-rotation.md](../secrets-rotation.md) si l'équipe grandit).
- **CLI** (`npm i -g vercel`, une fois) :

  ```bash
  vercel link                     # relie ce clone local au projet Vercel existant
  vercel env add DATABASE_URL preview      # ajoute/édite une variable scopée à un seul environnement
  vercel env pull .env.local               # récupère les valeurs Development dans un fichier local
  ```

  `vercel env add <NOM> <environnement>` évite de faire circuler des
  secrets en clair par chat/e-mail entre coéquipiers : celui qui a accès au
  projet Vercel pousse la valeur une fois, chacun la récupère ensuite via
  `vercel env pull` (après `vercel link`, qui demande une connexion au
  compte/à l'équipe Vercel — géré via Project → Settings → Members, à ne
  pas confondre avec les accès GitHub). Pratique à l'arrivée d'un nouveau
  développeur : pas de `.env` à lui envoyer manuellement pour tout ce qui
  est déjà dans Vercel, seuls les secrets **hors Vercel** restent à
  transmettre via `sops`/`.env.enc` (voir
  [docs/secrets-rotation.md](../secrets-rotation.md)) — ce sont deux
  canaux complémentaires, pas redondants : Vercel pour ce qui doit être
  identique entre Preview/Production, sops pour les surcharges strictement
  locales (ex. une clé de test personnelle, un mode debug).

## Base de données — Neon

1. Créer un projet Neon, récupérer les deux chaînes de connexion : celle avec
   `-pooler` (→ `DATABASE_URL`, utilisée au runtime par toutes les instances
   serverless) et la directe, sans `-pooler` (→ `DIRECT_URL`, requise par
   `prisma migrate`).
2. Ajouter `?connection_limit=` bas (1-3) sur `DATABASE_URL` en prod : chaque
   instance Vercel ouvre son propre pool Prisma, le pooler Neon (PgBouncer)
   multiplexe déjà les connexions — voir les commentaires dans
   [.env.example](../../.env.example).
3. Appliquer les migrations **avant** (ou pendant) le premier déploiement :

   ```bash
   DATABASE_URL=... DIRECT_URL=... npx prisma migrate deploy
   ```

   Le build Vercel (`postinstall` → `prisma generate`) ne fait **pas**
   `migrate deploy` automatiquement. Deux options :
   - lancer la commande manuellement depuis un poste avec les identifiants de
     prod avant chaque déploiement qui ajoute une migration ;
   - ou faire porter cette étape par la commande de build Vercel (Project
     Settings → Build & Development Settings → Build Command :
     `npx prisma migrate deploy && vite build`) pour l'automatiser — à activer
     sciemment, pas fait par défaut dans ce dépôt.

4. `npm run seed` (compte admin de démo + données) ne doit être lancé qu'en
   développement/démo, jamais contre la base de production — désormais
   **refusé par le script lui-même** si `VERCEL_ENV=production` (posé
   automatiquement par Vercel), sauf `FORCE_SEED=1` explicite. Ne couvre que
   le cas où le script serait, par erreur, câblé dans un déploiement — un
   lancement manuel local avec des identifiants de prod dans `.env` reste
   possible, à la seule vigilance de qui l'exécute. Le mot de passe partagé
   des comptes de démo (`DemoPass!2026` par défaut) est surchargeable via
   `SEED_DEMO_PASSWORD` si ce jeu de données doit exister ailleurs qu'un
   poste de dev local.

### Séparer Production, Preview et développement — branches Neon

**Ne jamais faire pointer Preview ou le développement local vers la même
base que Production** : un test e2e, une migration expérimentale ou une
requête buguée testée en Preview écrirait alors dans les vraies données
clients. Deux approches, de la plus simple à la plus automatisée :

1. **Un seul projet Neon, plusieurs branches** (recommandé, gratuit sur le
   plan Free Neon) :
   - Neon crée une branche `production` (ou `main`) par défaut lors de la
     création du projet — c'est celle à utiliser pour `DATABASE_URL`/
     `DIRECT_URL` **Production** dans Vercel.
   - Dashboard Neon → Branches → **Create branch**, à partir de
     `production` : copie-sur-écriture instantanée (pas de dump/restore à
     faire), la nouvelle branche (ex. `preview` ou `dev`) démarre avec les
     mêmes données puis diverge indépendamment — rien de ce qui est écrit
     dessus n'affecte `production`.
   - Récupérer les connexions (`-pooler` et directe) **propres à cette
     branche** (Neon affiche un sélecteur de branche au-dessus des chaînes
     de connexion — ne pas réutiliser par erreur celles de `production`).
   - Dans Vercel, renseigner `DATABASE_URL`/`DIRECT_URL` avec la valeur de
     la branche `production` pour l'environnement **Production**, et la
     valeur de la branche `preview`/`dev` pour les environnements
     **Preview** et **Development** (voir section CLI/dashboard ci-dessus
     pour scoper une variable par environnement).
   - Rejouer les migrations sur **chaque branche séparément** — appliquer
     une migration sur `production` ne la propage pas automatiquement à
     `preview`/`dev` (ce sont des bases indépendantes après la création de
     la branche) :

     ```bash
     DATABASE_URL=<branche-preview> DIRECT_URL=<branche-preview> npx prisma migrate deploy
     ```
2. **Intégration officielle Vercel ↔ Neon** (Vercel → Marketplace →
   Neon) : automatise la création d'**une branche Neon éphémère par
   Preview Deployment** (une par pull request), injecte automatiquement
   `DATABASE_URL`/`DIRECT_URL` dans l'environnement Preview correspondant,
   et supprime la branche quand le déploiement Preview est supprimé —
   évite de partager une seule branche `preview` entre toutes les PR
   ouvertes en simultané (ce que fait l'option 1 par défaut). Plus proche
   de « une base jetable par PR », au prix d'un peu plus de configuration
   initiale ; à activer une fois l'équipe au-delà d'un ou deux
   contributeurs, quand les collisions sur une branche `preview` partagée
   deviennent gênantes.

Pour le développement local en équipe, deux options équivalentes à la
branche `preview`/`dev` ci-dessus : soit tous les développeurs partagent la
même branche Neon `dev` (simple, mais une migration ou un `npm run seed`
lancé par l'un affecte les autres), soit chacun crée sa propre branche
personnelle à partir de `dev` (Neon Free autorise plusieurs branches) et en
renseigne les identifiants dans son `.env` local — à distribuer/chiffrer via
`sops` comme les autres secrets locaux (voir
[docs/secrets-rotation.md](../secrets-rotation.md)), jamais en les ajoutant
aux variables Vercel du projet qui sont, elles, partagées par toute
l'équipe.

### Automatiser via les CLI (`neonctl` + `vercel`) — sans passer par les dashboards

Les deux étapes manuelles ci-dessus (créer la branche Neon, reporter ses
connexions dans Vercel) se scriptent entièrement, pratique pour onboarder
un nouveau développeur ou recréer un environnement jetable sans cliquer :

1. Installer les deux CLI une fois (`npm i -g neonctl vercel`), puis
   s'authentifier (`neonctl auth` ouvre un navigateur et stocke un token
   local ; `vercel login`).
2. Créer la branche et récupérer ses connexions en une commande chacune
   (les flags exacts peuvent varier selon la version installée — vérifier
   avec `neonctl branches create --help` / `neonctl connection-string --help`) :

   ```bash
   NEON_PROJECT_ID=xxxxxxxx   # neonctl projects list

   neonctl branches create --project-id "$NEON_PROJECT_ID" \
     --name preview --parent production

   POOLED_URL=$(neonctl connection-string preview \
     --project-id "$NEON_PROJECT_ID" --pooled)
   DIRECT_URL_VAL=$(neonctl connection-string preview \
     --project-id "$NEON_PROJECT_ID")
   ```

3. Pousser directement ces valeurs dans Vercel, sans dashboard, en pipant la
   valeur sur `stdin` de `vercel env add` (évite le prompt interactif) :

   ```bash
   vercel link --yes   # une fois par poste, relie ce clone au projet Vercel

   printf '%s' "$POOLED_URL"    | vercel env add DATABASE_URL preview
   printf '%s' "$DIRECT_URL_VAL" | vercel env add DIRECT_URL preview
   ```

4. Nettoyage une fois la branche inutile : `neonctl branches delete preview --project-id "$NEON_PROJECT_ID"` puis `vercel env rm DATABASE_URL preview --yes` (et `DIRECT_URL`).

**Automatisation complète par PR (sans l'intégration Marketplace)** : Neon
publie aussi des GitHub Actions officielles
(`neondatabase/create-branch-action`, `neondatabase/delete-branch-action`)
pour créer/supprimer une branche depuis un workflow GitHub Actions plutôt
que depuis Vercel — utile si une branche Neon par PR doit être accessible
ailleurs que dans le Preview Deployment Vercel (ex. un job GitHub Actions
qui a besoin de sa propre base). Ce n'est **pas nécessaire** pour le job
`e2e` de ce dépôt, qui tourne déjà contre un conteneur Postgres 16 éphémère
local au run (voir [e2e/README.md](../../e2e/README.md)) — à réserver à un
besoin distinct (ex. partager la branche de preview avec un outil QA
externe).

## Stripe

1. Dashboard Stripe → Developers → API keys → `STRIPE_SECRET_KEY` (secrète) et
   `VITE_STRIPE_PUBLISHABLE_KEY` (publique).
2. Developers → Webhooks → **Add endpoint** :
   `https://<domaine-prod>/api/webhooks`, événements couvrant au minimum les
   paiements/checkout utilisés par `src/routes/api/webhooks/+server.ts`.
3. Récupérer le secret de signature de **cet endpoint Dashboard** (pas celui
   du CLI `stripe listen`, utilisé seulement en local) → `STRIPE_WEBHOOK_SECRET`.
4. Rotation : voir [docs/secrets-rotation.md](../secrets-rotation.md#stripe_secret_key--stripe_webhook_secret).

## Sendcloud

1. Panel Sendcloud → Settings → API access : `SENDCLOUD_PUBLIC_KEY` /
   `SENDCLOUD_SECRET_KEY`.
2. Récupérer `SENDCLOUD_INTEGRATION_ID` (`SENDCLOUD_SENDER_ADDRESS_ID` n'est
   plus nécessaire, voir le tableau ci-dessus).
3. Configurer le webhook Sendcloud vers
   `https://<domaine-prod>/api/webhooks/sendcloud`, secret →
   `SENDCLOUD_WEBHOOK_SECRET` (signature HMAC-SHA256, header
   `Sendcloud-Signature`).
4. `SENDCLOUD_BASE_URL=https://panel.sendcloud.sc` (valeur fixe, déjà dans
   `.env.example`).

## Cloudinary

1. Dashboard Cloudinary → `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
   `CLOUDINARY_API_SECRET`.
2. Aucune configuration webhook nécessaire : l'upload se fait depuis le
   serveur (`src/lib/server/cloudinary.ts`), pas d'upload preset non signé à
   déclarer côté Cloudinary.
3. Le domaine `res.cloudinary.com` est déjà autorisé dans la CSP
   (`img-src`) — pas de changement à faire si le cloud name change, seule
   l'URL de base des images change, pas le domaine.

## E-mails transactionnels — Brevo (SMTP)

1. Brevo → SMTP & API → récupérer l'hôte (`smtp-relay.brevo.com`), le port
   (`587`), l'identifiant SMTP et la clé API SMTP → `SMTP_HOST` / `SMTP_PORT`
   / `SMTP_USER` / `SMTP_PASS`.
2. `SMTP_FROM` optionnel (sinon adresse par défaut codée dans
   `src/lib/server/smtp-mail.ts`) — à définir avec une adresse validée côté
   Brevo (SPF/DKIM) pour éviter le spam.
3. Vérifier l'authentification du domaine d'envoi dans Brevo (SPF/DKIM/DMARC)
   avant la mise en prod : un expéditeur non authentifié atterrit en spam
   chez la plupart des fournisseurs, indépendamment de la config applicative.

## OAuth Google

1. Google Cloud Console → Identifiants OAuth 2.0 : ajouter l'URI de
   redirection de **production**
   (`https://<domaine-prod>/api/auth/callback/google` — montée par Better
   Auth, voir [docs/auth](../auth/README.md), plus
   `/auth/login/google/callback`, la route maison d'avant la migration) en
   plus de celle de dev — Google refuse toute redirection non listée.
2. `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Plus de variable `VITE_*` à
   aligner sur le domaine de prod : Better Auth calcule lui-même l'URI de
   callback depuis `APP_URL`/`VERCEL_URL` (voir `resolveAppUrlOrDefault()`).

## Upstash Redis (rate-limit, cache, verrous)

Optionnel mais recommandé en production : sans ces variables,
`src/lib/server/redis.ts` retombe sur un état en mémoire **par instance**
serverless, donc non partagé — rate-limit et verrous d'idempotence
deviennent inefficaces dès qu'il y a plus d'une instance active.

1. Créer une base Upstash Redis (REST API activée).
2. `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

## Upstash QStash (jobs asynchrones)

Optionnel : sans `QSTASH_TOKEN`, les jobs (facture, Sendcloud post-paiement,
relance panier, notification réassort, récompense parrainage) s'exécutent en
synchrone dans la requête qui les déclenche, comme avant l'introduction de la
queue — fonctionnel, mais alloue plus de temps de fonction par requête.

1. Upstash → QStash → récupérer `QSTASH_TOKEN`,
   `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`.
2. Définir `APP_URL` (voir note plus haut) : QStash doit rappeler une URL
   publique stable, jamais `VERCEL_URL` d'un Preview éphémère.
3. Après le déploiement, enregistrer les schedules récurrents (idempotent,
   à relancer seulement si l'URL publique change) :

   ```bash
   APP_URL=https://<domaine-prod> QSTASH_TOKEN=... npm run jobs:register-cleanup-schedule
   APP_URL=https://<domaine-prod> QSTASH_TOKEN=... npm run jobs:register-cart-recovery-schedule
   ```

### Vercel Cron vs QStash — limite du plan Hobby

`vercel.json` déclare `/api/jobs/cart-recovery` toutes les 30 minutes
(`*/30 * * * *`). **Le plan Vercel Hobby limite les Cron Jobs à une exécution
par jour** : ce fichier tel quel fait échouer le déploiement sur un projet
Hobby (`Hobby accounts are limited to daily cron jobs`). `/api/jobs/cleanup`
(quotidien) reste compatible Hobby.

Deux options, à choisir selon le plan Vercel du projet :

- **Plan Pro/Enterprise** : aucun changement nécessaire, `*/30 * * * *`
  fonctionne tel quel.
- **Plan Hobby** : soit passer par QStash pour la relance panier (schedule
  ci-dessus, qui n'est pas soumis à cette limite) et retirer/espacer l'entrée
  `cart-recovery` de `vercel.json` (ou la passer à une fréquence quotidienne
  en filet de sécurité), soit upgrader le plan.

Chaque route de job accepte les deux déclencheurs (signature QStash **ou**
`Authorization: Bearer $CRON_SECRET` de Vercel Cron) — les deux mécanismes
peuvent cohabiter sans changement de code, seule la déclaration
`vercel.json` est contrainte par le plan.

## Sentry (observabilité, plan gratuit compatible)

1. Créer un projet Sentry (JavaScript/SvelteKit).
2. `SENTRY_DSN` (serveur, `src/hooks.server.ts`) et `PUBLIC_SENTRY_DSN`
   (navigateur, `src/hooks.client.ts`) — peuvent provenir du même projet.
3. Optionnel : `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` pour
   l'upload des source maps en CI (désactivé par défaut dans
   `vite.config.ts`, à activer explicitement si besoin).
4. Sans DSN configuré, le SDK reste un no-op documenté (aucune erreur, aucun
   appel réseau) — safe de déployer sans, pour ajouter l'observabilité plus
   tard.

## TinyMCE (éditeur de blog admin)

`PUBLIC_TINYMCE_API_KEY` (clé gratuite TinyMCE Cloud) — nécessaire seulement
si le module blog est actif (`docs/blog/README.md`). Le script
`postinstall` copie déjà les assets TinyMCE self-hébergés
(`scripts/copy-tinymce.mjs`), aucune étape manuelle supplémentaire.

## CSP — bloquante (`directives`)

La CSP (`svelte.config.js` → `kit.csp`) est en mode **bloquant**
(`directives`, plus `reportOnly`). Les directives ont été établies par audit
statique du code (`grep` de tous les domaines externes appelés côté
navigateur dans `src/`), pas par observation DevTools en conditions réelles :

- `script-src`/`frame-src` : `js.stripe.com` + `hooks.stripe.com` (Stripe
  Elements/Checkout).
- `img-src` : `res.cloudinary.com` (images produits/blog) +
  `tiles.basemaps.cartocdn.com` (sprite de la carte MapLibre des points
  relais — chargé via une requête `Image`, donc `img-src` et pas
  `connect-src`) + `blob:` (aperçu local d'image avant upload via
  `URL.createObjectURL`, formulaires produit admin).
- `connect-src` : `api.stripe.com` + `tiles.basemaps.cartocdn.com` (tuiles
  vectorielles/glyphes MapLibre, via `fetch`) + `*.ingest.sentry.io` (remontée
  d'erreurs client, no-op sans `PUBLIC_SENTRY_DSN`).
- `worker-src` : `'self' blob:` — MapLibre GL instancie son propre Web
  Worker depuis un `blob:`, bloqué sinon.
- TinyMCE : self-hébergé (`/tinymce/tinymce.min.js`, même origine), plugins
  core uniquement (pas de plugin connu nécessitant `unsafe-eval`).
- Google OAuth : redirection serveur classique (`createAuthorizationURL` +
  `redirect`), pas de SDK JS côté client — aucune directive CSP requise.

**Résidu de risque à couvrir par un smoke-test réel** après le premier
déploiement avec cette politique (DevTools ouvertes, onglet Console/Network
filtré sur les erreurs CSP) : checkout jusqu'au paiement Stripe, éditeur
TinyMCE (`/admin/blog`), setup 2FA (QR code `data:`, couvert par `img-src`),
et la carte des points relais Sendcloud (`ServicePointMap.svelte`). `/api/csp-report`
reste actif en bloquant (il journalise _et_ bloque) : surveiller ses logs
juste après un déploiement reste le moyen le plus rapide de repérer une
directive manquante avant qu'un client ne le signale.

Si un nouveau service tiers appelé depuis le navigateur est ajouté plus tard
(nouveau CDN d'images, nouvelle carte, nouveau SDK de paiement...), ajouter
son domaine à la directive concernée **avant** la mise en prod — ne pas
compter sur `/api/csp-report` pour le découvrir après coup.

En cas de blocage inattendu en prod, le rollback le plus rapide est de
repasser `directives` en `reportOnly` dans `svelte.config.js` (revert ou
correctif ponctuel) et redéployer — ou **Promote to Production** d'un
déploiement antérieur sain (voir section Rollback ci-dessous).

## Rollback (revenir en arrière après un déploiement défaillant)

Vercel conserve chaque déploiement de Production comme une unité immuable
(code + assets) : revenir en arrière ne nécessite pas de rebuild ni de
revert Git, seulement de **repromouvoir** un déploiement précédent connu
comme sain.

1. Dashboard Vercel → projet → onglet **Deployments**.
2. Repérer le dernier déploiement de Production qui fonctionnait (marqué
   `● Ready`, antérieur au déploiement fautif).
3. Menu `...` de ce déploiement → **Promote to Production** (anciennement
   « Instant Rollback ») : le domaine de prod pointe à nouveau vers ce build
   en quelques secondes, sans réexécuter `npm ci` / `vite build` /
   `postinstall`.
4. Vérifier immédiatement après bascule : `vercel.json` (crons) et les
   variables d'environnement associées au déploiement restauré sont celles
   **en vigueur au moment de ce build**, pas les valeurs actuelles du
   dashboard — un rollback ne réapplique pas une ancienne valeur de variable
   d'environnement si elle a été modifiée depuis (Vercel fige les valeurs au
   moment du build, pas au moment du rollback).

### Ce que le rollback Vercel ne couvre pas

- **Migrations Prisma** : `prisma migrate deploy` est conçu pour être
  appliqué en avançant uniquement — ce dépôt ne fournit pas de migrations
  « down » automatiques. Revenir le code en arrière après une migration qui
  a modifié le schéma (colonne renommée/supprimée, contrainte ajoutée) peut
  casser le code restauré s'il suppose l'ancien schéma. Avant de rollback un
  déploiement qui a embarqué une migration :
  - si la migration est additive (nouvelle colonne nullable, nouvelle table)
    et que l'ancien code l'ignore simplement, le rollback applicatif seul
    suffit ;
  - si la migration est destructive ou modifie une colonne que l'ancien code
    lit/écrit différemment, il faut écrire et appliquer manuellement une
    migration corrective (ou restaurer un snapshot Neon, voir plus bas)
    **avant** ou **en même temps que** le rollback applicatif — jamais après,
    pour éviter une fenêtre où le code restauré tourne contre un schéma
    incompatible.
- **Neon (base de données)** : Neon conserve un historique de restauration
  point-in-time (durée selon le plan) via Dashboard Neon → Branches →
  **Restore** — à utiliser uniquement en dernier recours (perte de données
  entre le point de restauration et maintenant), indépendamment du rollback
  Vercel qui ne touche jamais la base.
- **Jobs déjà déclenchés** (QStash, Vercel Cron) : un job asynchrone
  planifié ou en file d'attente avant le rollback continue de s'exécuter
  contre le code restauré une fois celui-ci en place — pas d'action
  spécifique nécessaire si le rollback est rapide, mais à garder en tête si
  un job a échoué pendant la fenêtre du déploiement fautif (vérifier les
  logs Sentry/QStash après coup plutôt que de supposer qu'il s'est
  correctement rejoué).

## Checklist post-déploiement

1. `npx prisma migrate deploy` exécuté contre la base de prod (voir section
   Neon) — vérifier `npx prisma migrate status`.
2. Toutes les variables d'environnement de la table ci-dessus renseignées
   sur Vercel (Production **et** Preview si utilisées).
3. Webhooks configurés côté fournisseurs :
   `https://<domaine-prod>/api/webhooks` (Stripe),
   `https://<domaine-prod>/api/webhooks/sendcloud` (Sendcloud),
   `https://<domaine-prod>/api/auth/callback/google` (Google, redirect URI).
4. Si QStash configuré : schedules enregistrés
   (`npm run jobs:register-cleanup-schedule`,
   `npm run jobs:register-cart-recovery-schedule`) avec `APP_URL` pointant le
   domaine de prod, pas un Preview.
5. Si QStash **non** configuré : plan Vercel compatible avec la fréquence des
   Cron Jobs de `vercel.json` (voir section dédiée) et `CRON_SECRET` défini.
6. Modules optionnels : chaque module active son propre flag dans
   `/admin/settings` (voir [docs/admin/README.md](../admin/README.md)) — les
   activer une fois les services tiers correspondants configurés, pas avant
   (ex. activer les alertes réassort seulement après avoir vérifié que le SMTP
   Brevo fonctionne, activer le programme de fidélité seulement après avoir
   vérifié Stripe).
7. Smoke test manuel : inscription + vérification e-mail, connexion Google,
   ajout panier → checkout → paiement test Stripe → réception facture,
   upload d'image produit (Cloudinary), création d'étiquette Sendcloud.
8. Sécurité du compte (aucune config supplémentaire, dépend seulement de
   SMTP + `APP_URL` déjà vérifiés ci-dessus) : se connecter depuis un
   second navigateur/appareil → e-mail « nouvelle connexion détectée » reçu
   avec un lien « Ce n'était pas moi » cliquable ; changer son mot de passe
   depuis `/auth/settings` → e-mail de confirmation reçu ; vérifier que
   `/auth/settings/sessions` liste bien la session et son historique.
