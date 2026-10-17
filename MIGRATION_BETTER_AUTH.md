# Migration Lucia → Better Auth

Document vivant. Exécuté en autonomie suite à la demande explicite de
l'utilisateur (voir `RECOMMANDATIONS_SVELTEKIT.md` §1) : remplacer Lucia
(dépréciée) par Better Auth, en préservant tout le comportement métier
construit par-dessus (2FA, sessions actives, alertes de sécurité, RGPD,
admin). Mis à jour à chaque étape franchie plutôt que réécrit.

## Pourquoi ce document

L'inventaire complet du système actuel (fait avant de commencer, voir
historique git de ce fichier et `git log` pour le détail) montre que Lucia
elle-même n'est utilisée que pour trois choses : le cookie de session, la
validation de session, l'invalidation. Tout le reste — mots de passe, 2FA,
vérification email, reset, alertes, RGPD — est du code métier maison déjà
indépendant de Lucia. La migration ne doit donc toucher que ce noyau +
profiter de l'occasion pour adopter aussi les équivalents mûrs de Better
Auth pour OAuth Google et la 2FA (actuellement maison via `arctic`/`@oslojs/otp`),
plutôt que de reconstruire un système maison équivalent au-dessus d'un
nouveau cookie.

## Décisions de conception (actées, pas à rouvrir sans raison nouvelle)

1. **`event.locals` garde exactement la même forme** (`session`, `user`,
   `role`, `isMfaEnabled`, `registered2FA`). C'est le point d'entrée de
   l'identité dans des dizaines de fichiers consommateurs
   (`+layout.server.ts`, `/checkout`, tout `/admin/**`, toutes les routes
   `/auth/settings/*` commerce-plugin, `Navigation.svelte`, `Cart.svelte`...)
   — aucun d'eux ne doit changer. Seul `src/lib/lucia/hooks.ts` (devenu
   `src/lib/auth/hooks.ts`) change d'implémentation interne.
2. **La table `User` est réutilisée telle quelle** comme modèle `user` de
   Better Auth (mapping `modelName`/`fields`), pas dupliquée — elle est
   partagée avec tout le commerce (adresses, commandes...), la dupliquer
   créerait un vrai risque de désynchronisation. Seuls des champs
   supplémentaires exigés par Better Auth (`twoFactorEnabled`, `banned`,
   `banExpires`, `banReason`) sont ajoutés en colonnes, de façon additive.
3. **Nouvelles tables** (remplacent `Session` Lucia) : `session`,
   `account` (identifiants + Google), `verification` (scaffolding interne
   Better Auth), `twoFactor` (secret TOTP + codes de secours). Gérées par
   Better Auth, générées via `npx @better-auth/cli generate` puis migrées
   via Prisma comme d'habitude (pas `auth migrate`, réservé à l'adapter
   Kysely intégré).
4. **`EmailVerificationRequest`/`PasswordResetSession` sont CONSERVÉES
   à l'identique.** Ce ne sont pas des tables Lucia (Lucia n'a jamais géré
   la vérification d'email ni le reset) — c'est du code 100 % maison, déjà
   indépendant. Le parcours par CODE à 8 caractères (pas de lien cliqué) et
   le verrou 2FA sur le reset (`/auth/reset-password/2fa`) sont préservés
   sans changement visible côté utilisateur. Seule la toute dernière étape
   (écrire le nouveau mot de passe) change de cible : `account.password`
   au lieu de `User.passwordHash`.
5. **`LoginEvent`/`SessionRevokeToken` sont CONSERVÉES à l'identique** —
   historique de sécurité et lien « Ce n'était pas moi », aucun équivalent
   Better Auth, logique 100 % maison déjà indépendante de Lucia.
6. **Mots de passe** : Better Auth configuré avec un hash/verify custom
   utilisant `@node-rs/argon2` avec EXACTEMENT les mêmes paramètres
   qu'aujourd'hui (`memoryCost 19456, timeCost 2, outputLen 32, parallelism 1`)
   — script de migration one-shot qui copie chaque `User.passwordHash`
   existant vers une ligne `account` (`providerId: 'credential'`), **aucun
   utilisateur ne doit réinitialiser son mot de passe**.
7. **Google OAuth** : migré vers `socialProviders.google` de Better Auth.
   Script de migration one-shot : chaque `User.googleId` existant devient
   une ligne `account` (`providerId: 'google'`), **aucun compte Google ne
   doit se relier à nouveau**.
8. **2FA (TOTP + codes de secours)** : migré vers le plugin `twoFactor()`
   de Better Auth. ⚠️ **Impact utilisateur réel et documenté** (pas une
   surprise silencieuse) : le secret TOTP actuel est chiffré avec notre
   propre AES-256-GCM (`ENCRYPTION_KEY`), format non compatible avec le
   stockage interne de Better Auth (non documenté publiquement, donc non
   reproductible de façon fiable). **Tout compte avec la 2FA active devra
   la reconfigurer une fois** après le déploiement (nouveau QR code,
   nouveau code de secours) — annoncé dans la doc de déploiement et dans
   un message in-app, pas découvert par surprise.
9. **Rôle admin** : plugin `admin()` de Better Auth avec
   `adminRoles: ['ADMIN']` — correspond exactement à l'enum `Role` déjà en
   base (`ADMIN`/`CLIENT`), aucune migration de données nécessaire sur ce
   champ.
10. **Rate limiting, alertes, RGPD restent maison** : Better Auth a son
    propre rate-limiter interne, mais nos quotas actuels (par IP, par
    compte, délai croissant) sont plus fins et déjà testés — conservés via
    nos primitives existantes (`$lib/server/rate-limit.ts`), appliquées
    dans des `hooks.before` qui interceptent les chemins Better Auth
    concernés avant de les laisser continuer. Alerte nouvel appareil,
    alerte mot de passe changé, alerte échecs de connexion répétés,
    anonymisation RGPD : conservées, rebranchées sur les points
    d'extension de Better Auth (`databaseHooks.session.create.after` pour
    l'historique de connexion + nouvel appareil, `hooks.after` sur
    `/sign-in/email` pour les échecs).
11. **Toutes les sessions existantes seront invalidées au déploiement**
    (nouvelle table, nouveau format de cookie) — inévitable et à annoncer,
    pas un défaut de la migration mais une conséquence du changement de
    système. Pas un problème pour les mots de passe/comptes Google
    (préservés, voir §6-7), uniquement une reconnexion à faire.

## Phases

Chaque phase se termine par `npm run check` + `npx eslint .` + `npx vitest
run` + les specs e2e `e2e/auth/**` concernées, avant de passer à la
suivante. Commit par phase.

- [ ] **Phase 0** — Dépendances (`better-auth`, adapter Prisma déjà inclus
      dans le paquet principal), configuration minimale (`src/lib/auth/index.ts`),
      montage dans `hooks.server.ts` en PARALLÈLE de Lucia (pas encore de
      bascule), schéma Prisma étendu (nouvelles tables + champs additifs sur
      `User`), migration Prisma appliquée aux deux bases (dev + e2e).
- [ ] **Phase 1** — Scripts de migration de données (mots de passe,
      comptes Google) + vérification manuelle sur une copie/un échantillon.
- [ ] **Phase 2** — Bascule de `authHandle` : lit Better Auth au lieu de
      Lucia, construit `locals` à l'identique. Signup/login/logout/Google
      réécrits pour passer par `auth.api`. 2FA (setup/vérification/reset)
      réécrite sur le plugin `twoFactor`. Rate-limiting, alertes, historique de
      connexion rebranchés.
- [ ] **Phase 3** — Email verification, reset de mot de passe (code + 2FA),
      self-service sessions actives, RGPD, admin (reset mdp/MFA tiers) —
      repointés sur les nouvelles tables sans changement de comportement
      visible.
- [ ] **Phase 4** — Suppression de Lucia (`lucia`, `@lucia-auth/adapter-prisma`,
      `arctic`), suppression des anciennes tables (`Session` Lucia, champs
      `User` devenus inutiles si sûr de ne plus en avoir besoin après coup —
      sinon laissés en place une itération de plus par prudence), suppression
      des fichiers `src/lib/lucia/**` devenus morts.
- [ ] **Phase 5** — Mise à jour de la documentation (`docs/auth/README.md`,
      `docs/auth/retrait.md`, `docs/deployment/README.md` — nouvelles variables
      d'environnement `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL`, note sur la
      reconfiguration 2FA obligatoire) + `RESTE_A_FAIRE.md`.
- [ ] **Phase 6** — Vérification finale complète (suite e2e intégrale,
      pas seulement `e2e/auth/**` — Better Auth touche l'identité donc
      potentiellement tout parcours connecté).

## Journal d'exécution

(Rempli au fur et à mesure, pas à l'avance.)
