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
12. **Architecture 2FA fondamentalement différente de Lucia.** Chez Lucia,
    le login créait IMMÉDIATEMENT une session (`twoFactorVerified: false`),
    et chaque page vérifiait ce drapeau. Better Auth ne crée JAMAIS de
    session tant que le second facteur (si exigé) n'a pas été validé :
    `signInEmail` renvoie `{twoFactorRedirect: true}` et pose un cookie
    signé éphémère (« two_factor »), opaque pour notre code — seul
    `auth.api.verifyTOTP`/`verifyBackupCode` sait le lire. Conséquences :
    - `event.locals.session`/`.session.twoFactorVerified` n'existe plus : si
      une session existe, la 2FA (si exigée) est déjà passée. `authHandle`
      (`$lib/auth/hooks.ts`) ne garde que le cas « 2FA exigée mais jamais
      configurée » (redirige vers `/auth/2fa/setup`).
    - `/auth/2fa` (code TOTP après connexion) et `/auth/2fa/reset` (code de
      secours) n'ont plus besoin de session préalable : ils appellent
      `auth.api.verifyTOTP`/`verifyBackupCode` directement, qui créent la
      session définitive en cas de succès (cookies appliqués via
      `applyAuthCookies`, voir §15).
13. **Un seul code de secours par compte, pas dix.** Le plugin `twoFactor`
    de Better Auth génère par défaut 10 codes de secours réutilisables
    individuellement (modèle différent de l'ancien `User.recoveryCode`
    unique, qui RETIRAIT la 2FA une fois utilisé). Pour préserver le
    comportement existant (un seul code, son usage retire la 2FA et force
    une reconfiguration), `backupCodeOptions: { amount: 1, length: 15 }`
    (`$lib/auth/index.ts`) — `length: 15` donne un code affiché de 16
    caractères (5 + tiret + 10), identique à l'ancien format en longueur.
    `$lib/auth/twoFactor.ts` (`disableTwoFactor`) retire explicitement la
    2FA après usage du code de secours — Better Auth ne le fait jamais de
    lui-même (son modèle natif n'en a pas besoin, vu que plusieurs codes
    existent).
14. **Configurer/retirer la 2FA ne demande jamais le mot de passe**
    (`allowPasswordless: true` dans le plugin `twoFactor`) — même
    comportement qu'avant la migration (l'ancienne interface ne le
    demandait pas non plus). Compromis de sécurité assumé, pas un oubli.
15. **Jamais de cookie de session signé à la main.** Toute création/
    modification de session passe par `auth.api.X({ returnHeaders: true })`
    + `applyAuthCookies()` (`$lib/auth/cookies.ts`), qui rejoue les
    `Set-Cookie` renvoyés par Better Auth tels quels. Conséquence directe :
    **une réinitialisation de mot de passe (`/auth/forgot-password` →
    `/auth/reset-password`) ne reconnecte plus automatiquement** —
    contrairement à l'ancien comportement Lucia. En effet, à cette étape
    du parcours il n'existe ni session Better Auth ni cookie « two_factor »
    pendant (l'identité a été prouvée par notre propre code+2FA maison,
    jamais par un appel `auth.api`), et toute tentative de ré-authentifier
    via `auth.api.signInEmail` avec le nouveau mot de passe redéclencherait
    une 2FA déjà prouvée dans CE MÊME parcours. Fabriquer la session à la
    main exigerait de reproduire la signature HMAC-SHA256 interne de
    Better Auth (algorithme stable mais non documenté publiquement, et le
    nom du cookie varie lui-même en production selon `__Secure-` — risque
    jugé disproportionné face au gain). L'utilisateur se reconnecte donc
    explicitement avec son nouveau mot de passe — testé ainsi dans
    `journey.spec.ts` (étape 13) et `reset-password-2fa.spec.ts`.
    Les autres flux concernés restent inchangés côté UX :
    - `/auth/settings` (changement de mot de passe) : une session existe
      déjà, `auth.api.changePassword({ revokeOtherSessions: true })` la
      réémet légitimement — aucune reconnexion requise.
    - `/auth/2fa/reset` (code de secours **pendant une connexion normale**,
      pas pendant un reset de mot de passe) : `verifyBackupCode` crée la
      session via le mécanisme normal de Better Auth — aucune reconnexion
      requise non plus.
16. **Bypass e2e de Google OAuth** (remplace l'ancien `isE2eGoogleBypass`
    codé en dur dans `/auth/login/google/callback`) : l'échange de code
    OAuth réel (`https://oauth2.googleapis.com/token`) est codé en dur côté
    Better Auth, donc jamais simulable. Le point d'extension officiel est
    `verifyIdToken` (option du provider), utilisé pour le flux « sign-in
    with ID token » (`auth.api.signInSocial({ idToken })`) — conçu pour les
    apps mobiles/SPA qui obtiennent déjà un ID token Google par un autre
    canal, sans jamais passer par l'échange de code. Quand
    `GOOGLE_CLIENT_ID` est factice (`isDummySecret`, donc jamais en
    production), `verifyIdToken` devient permissif et accepte un JWT
    syntaxiquement valide mais non signé — voir `$lib/auth/index.ts` et
    `e2e/auth/google.spec.ts`.

## Phases

Chaque phase se termine par `npm run check` + `npx eslint .` + `npx vitest
run` + les specs e2e `e2e/auth/**` concernées, avant de passer à la
suivante. Commit par phase.

- [x] **Phase 0** — Dépendances, configuration minimale
      (`src/lib/auth/index.ts`), montage dans `hooks.server.ts`, schéma
      Prisma étendu (`AuthSession`/`AuthAccount`/`AuthVerification`/
      `TwoFactor` + 4 colonnes `User`), migration Prisma appliquée aux deux
      bases (dev + e2e). Bascule directe (pas de coexistence parallèle avec
      Lucia : décidé en cours de route, la coexistence n'apportait rien de
      plus qu'un git stash pour revenir en arrière si besoin).
- [x] **Phase 1** — `scripts/migrate-better-auth-accounts.mjs` (mots de
      passe, comptes Google → `AuthAccount`), vérifié empiriquement (connexion
      réelle avec un hash Argon2id pré-migration, inchangé).
- [x] **Phase 2** — `authHandle` (`$lib/auth/hooks.ts`) lit Better Auth,
      construit `locals` à l'identique. Signup/login/logout/Google réécrits
      sur `auth.api`. 2FA (setup/vérification post-login/reset par code de
      secours) réécrite sur le plugin `twoFactor` (voir §12-14). Alertes et
      historique de connexion rebranchés (`$lib/auth/finalizeLogin.ts`).
      Rate-limiting : conservé via les mêmes primitives
      (`$lib/server/rate-limit.ts`), appliqué directement dans les routes
      SvelteKit réécrites (pas de `hooks.before` Better Auth : inutile, ces
      routes restent sous notre contrôle total).
- [x] **Phase 3** — Email verification (garde 2FA simplifiée, voir §12),
      reset de mot de passe (code + 2FA, voir §15), self-service sessions
      actives (`AuthSession`, `$lib/auth/session.ts`), RGPD
      (`anonymizeUser.ts` purge aussi `AuthAccount`/`TwoFactor`), admin
      (reset mdp/MFA tiers → `AuthAccount`/`invalidateUserSessions`).
- [x] **Phase 4** — Fichiers `src/lib/lucia/{index,session,hooks,password,
      user,oauth,2fa,passwordReset}.ts` supprimés (zéro import restant,
      vérifié par grep avant suppression). Dépendances npm (`lucia`,
      `@lucia-auth/adapter-prisma`, `arctic`) et modèle Prisma `Session`
      (Lucia) **pas encore retirés** à ce stade — voir note ci-dessous.
      `src/lib/lucia/{ids,utils,email-verification,deviceContext,
      deviceLabel,encryption}.ts` **gardés sous ce chemin** : généreux,
      sans dépendance sur l'objet `Lucia`/la table `Session`, toujours
      utilisés (génération d'id/OTP, vérification d'email, empreinte
      d'appareil) — un renommage mécanique (`src/lib/lucia/` →
      `src/lib/shared-auth/` ou fusion dans `$lib/server/`) est prévu mais
      pas bloquant, pas fait dans cette passe pour limiter le risque d'une
      dernière réécriture de masse juste avant la vérification finale.
- [ ] **Phase 5** — Documentation (`docs/auth/README.md`,
      `docs/deployment/README.md`, `RESTE_A_FAIRE.md`).
- [ ] **Phase 6** — Vérification finale complète (suite e2e intégrale).

## Écarts restants (à traiter avant de considérer la migration terminée)

- Dépendances npm `lucia`/`@lucia-auth/adapter-prisma`/`arctic` encore
  dans `package.json` — plus aucun import dans `src/`, à retirer avec
  `npm uninstall` + une migration Prisma qui supprime le modèle `Session`
  (Lucia) et les 4 colonnes `User` désormais mortes (`passwordHash`,
  `totpKey`, `recoveryCode`, `encryptionVersion`) une fois la suite e2e
  complète confirmée verte sur cette base.
- `src/lib/prisma/user/user.ts` : plusieurs fonctions marquées
  `AUTH-PLUGIN` (`createUserInDatabase`, `getUserByGoogleIdPrisma`,
  `getUserTotpKey`, `updateUserRecoveryCode`, `upgradeUserTotpKeyEncryption`,
  etc.) n'ont probablement plus aucun appelant réel — pas purgées dans
  cette passe (zéro risque à les laisser, le compilateur ne signale pas
  un export inutilisé) ; à vérifier par grep avant suppression définitive.
- Renommage `src/lib/lucia/` → un chemin neutre (voir Phase 4) : ~24
  sites d'import à travers `src/`, mécanique mais pas fait.

## Journal d'exécution

(Rempli au fur et à mesure, pas à l'avance.)
