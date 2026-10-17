# Authentification

Module d'identité du projet : comptes locaux (email + mot de passe), connexion
Google, vérification d'adresse, double authentification TOTP avec code de secours,
réinitialisation de mot de passe, sessions en base.

Construit sur [Better Auth](https://www.better-auth.com/) depuis la migration
documentée dans [`MIGRATION_BETTER_AUTH.md`](../../MIGRATION_BETTER_AUTH.md)
(remplace Lucia, dépréciée) — ce document y renvoie pour toute décision
d'architecture ; il décrit ici l'état courant du fonctionnement.

## Frontière du module

Tout le code d'authentification vit dans ces emplacements :

| Emplacement                                                                     | Contenu                                                                               |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/lib/auth/`                                                                  | instance Better Auth, hook `authHandle`, mots de passe, 2FA directe, sessions, cookies |
| `src/lib/lucia/`                                                                 | utilitaires génériques restants (génération d'id/OTP, email de vérification, empreinte d'appareil) — voir note ci-dessous |
| `src/routes/auth/`                                                               | pages et endpoints du parcours, dont `not-me/` (révocation sans connexion)              |
| `src/lib/schema/auth/`                                                          | schémas Zod des formulaires                                                           |
| `src/lib/prisma/{session,emailVerificationRequest,passwordResetSession,email}/` | accès aux tables d'authentification                                                   |
| `src/lib/prisma/loginEvent/`                                                     | historique des connexions (voir « Sécurité du compte » ci-dessous)                     |
| `src/lib/prisma/sessionRevokeToken/`                                             | jetons à usage unique du lien « Ce n'était pas moi »                                   |
| `src/lib/prisma/user/anonymizeUser.ts`                                          | suppression de compte par anonymisation (self-service et admin)                        |
| `src/lib/server/{newDeviceAlert,passwordChangedAlert,failedLoginAlert}.ts`      | alertes email de sécurité du compte                                                    |

> `src/lib/lucia/` ne contient plus Lucia elle-même (supprimée) : le nom du
> dossier est un vestige de la migration, à renommer mécaniquement un jour
> (voir « Écarts restants » de `MIGRATION_BETTER_AUTH.md`) — son contenu
> actuel n'a aucune dépendance sur une bibliothèque d'authentification.

Le module s'accroche au reste du projet en **un seul point** : le hook
`authHandle` (`src/lib/auth/hooks.ts`), branché dans `src/hooks.server.ts`
(juste après `betterAuthHandle`, qui monte les endpoints Better Auth sous
`/api/auth/**`).

Partout ailleurs, une dépendance à l'authentification est signalée par un
marqueur `AUTH-PLUGIN` en commentaire. La liste exhaustive s'obtient ainsi :

```bash
rg "AUTH-PLUGIN" src/ prisma/
```

Deux règles maintiennent cette frontière :

1. aucun fichier hors du module n'importe `$lib/auth` sans marqueur ;
2. l'identité ne circule que par `event.locals` (typé dans `src/app.d.ts`), jamais
   par un import direct du module depuis une page.

## Modèle de données

`User` (partagée avec le commerce : `Address`, `Order`, `Transaction` s'y
rattachent) porte les champs d'identité (email, nom d'utilisateur, rôle,
`isMfaEnabled`) ; quatre tables Better Auth et deux tables 100 % maison la
complètent, décrites dans `prisma/schema.prisma`.

| Table                         | Rôle                                                                                             | Durée de vie        |
| ----------------------------- | ------------------------------------------------------------------------------------------------ | ------------------- |
| `auth_sessions`               | sessions ouvertes (Better Auth), appareil/localisation approximative, dernière activité          | 30 jours, glissante |
| `auth_accounts`               | identifiants par fournisseur — mot de passe local (`providerId: "credential"`) ou Google (`"google"`) | permanente     |
| `auth_verifications`          | scaffolding interne Better Auth (cookie « two_factor » en attente de vérification, etc.)         | courte, variable     |
| `two_factors`                 | secret TOTP chiffré + code de secours chiffré (voir « Double authentification »)                 | permanente           |
| `email_verification_requests` | code à 8 caractères pour valider une adresse — 100 % maison, pas Better Auth                     | 10 minutes           |
| `password_reset_sessions`     | progression d'une réinitialisation (code, 2FA, mot de passe) — 100 % maison, pas Better Auth     | 10 minutes           |
| `login_events`                | historique des connexions (appareil, localisation, méthode), survit à l'expiration de la session | 90 jours             |
| `session_revoke_tokens`       | jeton à usage unique du lien « Ce n'était pas moi » (email de nouvel appareil)                   | 7 jours              |

Les quatre tables Better Auth, `login_events` et `session_revoke_tokens`
appartiennent exclusivement au module et disparaissent avec `User`
(`onDelete: Cascade`). Le secret TOTP et le code de secours sont chiffrés en
base (XChaCha20-Poly1305, clé `BETTER_AUTH_SECRET`), pas hachés : le serveur
doit pouvoir les relire pour générer/valider un code.

## Parcours

### Inscription et vérification d'adresse

L'inscription crée le compte, ouvre une session et envoie un code à 8 caractères
par email. Le compte existe alors avec `emailVerified = false`, ce qui ne donne
accès à rien d'autre qu'à la page de vérification.

```
/auth/signup → /auth/verify-email → /auth
```

L'identifiant de la demande est déposé dans un cookie dédié : la page de saisie
retrouve ainsi la demande en cours sans exposer d'identifiant dans l'URL. Un
renvoi de code supprime la demande précédente, donc invalide l'ancien code.

### Connexion

```
/auth/login → /                      (compte sans 2FA)
/auth/login → /auth/2fa → /auth      (2FA exigée et configurée)
/auth/login → /auth/verify-email     (adresse non vérifiée)
```

La vérification du mot de passe est déléguée à `auth.api.signInEmail`
(Better Auth). Si le compte exige la 2FA, **aucune session n'est créée** à
cette étape : Better Auth pose un cookie signé éphémère (« two_factor »,
opaque pour notre code) et renvoie `{ twoFactorRedirect: true }`, lu par
`/auth/login/+page.server.ts` pour rediriger vers `/auth/2fa` — c'est
seulement la validation du code qui crée la session définitive (voir
« Double authentification »).

Deux protections se cumulent : un quota par adresse IP et un délai croissant par
compte après chaque échec (jusqu'à cinq minutes d'attente). Un compte créé via
Google n'a pas de mot de passe local ; toute tentative de connexion classique est
refusée comme un mot de passe invalide, sans révéler la nature du compte.

### Connexion Google

```
authClient.signIn.social({ provider: 'google' }) → Google → /api/auth/callback/google → /
```

Entièrement géré par Better Auth (`socialProviders.google`,
`src/lib/auth/index.ts`) : plus de routes `/auth/login/google*` maison, plus
de cookies PKCE à gérer nous-mêmes. Le bouton (`src/lib/auth/client.ts`)
appelle le client Better Auth en JavaScript — jamais un simple lien, cet
appel est un `POST`. Au retour, le compte est retrouvé ou créé par Better
Auth (`AuthAccount`, `providerId: "google"`), avec l'adresse déjà considérée
comme vérifiée puisque validée par Google ; un hook
(`databaseHooks.account.create.after`) resynchronise `User.googleId` pour
les quelques écrans qui le lisent encore directement (« ce compte a-t-il un
mot de passe local ? »).

### Double authentification

La 2FA se déroule en deux temps, volontairement distincts :

- **exigée** (`User.isMfaEnabled`) : demandé depuis les paramètres du compte ;
- **configurée** (`User.twoFactorEnabled`, via le plugin `twoFactor` de
  Better Auth) : une clé TOTP existe et a été validée une première fois.

Tant que la 2FA est exigée sans être configurée, `authHandle` confine la
navigation à `/auth/2fa/setup`. Une fois configurée, le second facteur est
déjà passé au moment où une session existe : contrairement à l'ancien modèle
(une session « ouverte mais 2FA en attente » revérifiée à chaque requête),
Better Auth ne crée jamais de session tant que le code n'a pas été validé —
il n'y a donc plus rien à revérifier après coup.

```
paramètres → /auth/2fa/setup → /auth/recovery-code
connexion  → /auth/2fa → /auth
téléphone perdu (pendant une connexion) → /auth/2fa/reset → /auth/2fa/setup
```

Le code de secours (16 caractères) est délivré une seule fois, à la
configuration (`auth.api.enableTwoFactor`, un seul code — voir
`backupCodeOptions` dans `MIGRATION_BETTER_AUTH.md` §13) ; Better Auth ne
permet plus de le relire ensuite, il transite donc par un cookie éphémère de
`/auth/2fa/setup` jusqu'à `/auth/recovery-code`. L'utiliser retire la 2FA
(`$lib/auth/twoFactor.ts`, `disableTwoFactor`) et force une reconfiguration —
même comportement qu'avant la migration.

### Mot de passe oublié

Trois étapes obligatoires, dont la progression est enregistrée dans la session de
réinitialisation (100 % maison, indépendante de Better Auth — voir
`MIGRATION_BETTER_AUTH.md` §4), ce qui interdit d'accéder directement à la
dernière page :

```
/auth/forgot-password
  → /auth/reset-password/verify-email     (code reçu par email)
  → /auth/reset-password/2fa              (si le compte exige la 2FA)
  → /auth/reset-password                  (nouveau mot de passe)
  → /auth/login
```

Changer le mot de passe invalide toutes les autres sessions du compte (et,
ici, la session courante aussi : voir ci-dessous). **Contrairement à un
changement de mot de passe depuis `/auth/settings`, une réinitialisation ne
rouvre jamais de session automatiquement** — il n'existe à cette étape ni
session Better Auth ni cookie « two_factor » à réutiliser pour en réémettre
une sans redemander un facteur déjà prouvé par ce même formulaire (détail
complet : `MIGRATION_BETTER_AUTH.md` §15). L'utilisateur se reconnecte
simplement avec son nouveau mot de passe.

### Sécurité du compte et RGPD self-service

Chaque connexion réussie (mot de passe, Google, réinitialisation — jamais une
simple réémission de session comme la validation 2FA) enregistre un
`LoginEvent` (`src/lib/prisma/loginEvent/loginEvent.ts`), avec appareil et
localisation approximative (en-têtes de géolocalisation Vercel, jamais un
service tiers séparé). L'appareil est comparé via une empreinte normalisée
(`normalizeDeviceFingerprint()`, `src/lib/lucia/deviceLabel.ts` — utilitaire
générique, voir la note sur ce dossier en tête de document) — OS +
navigateur + **version majeure uniquement**, pas le User-Agent exact :
Chrome se met à jour toutes les ~4 semaines avec un User-Agent différent à
chaque fois, une comparaison exacte aurait déclenché une alerte « nouvel
appareil » quasi mensuelle pour la propre machine de l'utilisateur (fatigue
d'alerte). Si l'appareil ne correspond à aucune connexion des 90 derniers
jours, un email « nouvel appareil » part
(`src/lib/server/newDeviceAlert.ts`) avec un lien de révocation sans connexion
(`/auth/not-me/[token]`, jeton à usage unique `SessionRevokeToken`, 7 jours).

Deux autres alertes email suivent le même principe (informer sans bloquer) :
un changement de mot de passe (`src/lib/server/passwordChangedAlert.ts`, avec
lien vers « mot de passe oublié ») et des tentatives de connexion échouées
répétées sur un compte (`src/lib/server/failedLoginAlert.ts`, seuil de 3 en
15 minutes, une seule alerte par fenêtre).

`/auth/settings/sessions` liste les sessions actives (appareil, IP,
localisation, dernière activité) avec révocation individuelle ou groupée
(« déconnecter les autres appareils »). `/auth/settings/donnees` couvre les
droits RGPD à la portabilité (export JSON complet) et à l'effacement — jamais
une suppression physique du compte : `anonymizeUser()`
(`src/lib/prisma/user/anonymizeUser.ts`) scrube les champs identifiants et
supprime les données de préférence sans valeur de conservation, mais conserve
`Order`/`Transaction` (obligation comptable, Code de commerce L123-22). Le
flux admin (`/admin/users?/deleteUser`) utilise la même fonction.

### Espace compte

`/auth/settings` couvre le changement d'adresse (avec revalidation par code), le
changement de mot de passe (mot de passe actuel exigé), l'activation de la 2FA,
et pour un `CLIENT` un interrupteur de consentement aux emails marketing
(`User.marketingEmailsOptIn`, `false` par défaut — opt-in explicite). Ce
réglage ne concerne jamais les emails transactionnels (facture, confirmation
de commande, réinitialisation de mot de passe), toujours envoyés quel que
soit son état ; au 16/09/2026 rien ne consomme encore ce champ pour l'envoi
de campagnes, c'est une préférence enregistrée en avance de la fonctionnalité.

Cinq sections hébergées sous `/auth/settings` relèvent d'autres modules et non
de l'authentification, chacune marquée dans son code (`COMMERCE-PLUGIN`/
`PRODUCT-PLUGIN`, ou conditionnée à un `StoreSettings.*Enabled`) :
`address/` (carnet d'adresses), `factures/` (transactions), `returns/`
(retours/SAV), `saved-payments/` (moyens de paiement enregistrés) et
`wishlist/` (liste d'envies) ; `referral/` (parrainage) dépend en plus de
`StoreSettings.referralEnabled`. Elles sont à déplacer, pas à supprimer, en
cas de retrait du module.

## Gardes d'accès

Les contrôles existent à deux niveaux, et ce doublon est voulu : le hook couvre
les routes qu'on ajoutera demain, la page protège son propre cas d'usage.

| Niveau                | Portée                                                                                |
| --------------------- | ------------------------------------------------------------------------------------- |
| `authHandle`          | 2FA exigée non configurée, 2FA non validée, `/auth/settings/**` anonyme               |
| `load` de chaque page | état précis attendu par la page (session de reset, email vérifié, etc.)               |
| `/admin/**`           | `adminHandle` : connexion **et** rôle `ADMIN` (voir [docs/admin](../admin/README.md)) |
| `/checkout`           | connexion (commande et adresses rattachées au compte)                                 |

`authHandle` ne protège pas `/admin` : c'est `adminHandle` (`src/lib/admin/hooks.ts`),
branché juste après, qui s'en charge.

## Sécurité

| Sujet             | Choix                                                                                                                                                                                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mots de passe     | Argon2id (19 MiB, 2 passes), longueur minimale 8, refus des mots de passe connus de « Have I Been Pwned » (interrogé en k-anonymat : seuls 5 caractères de l'empreinte SHA-1 sortent du serveur)                                                                 |
| Sessions          | gérées par Better Auth : token opaque, cookie signé (HMAC-SHA256) `httpOnly` + `sameSite=lax` + `secure` en production ; le token (secret) est distinct de l'id de ligne (`AuthSession.id`), jamais confondus — contrairement à l'ancien modèle Lucia             |
| Secrets 2FA       | XChaCha20-Poly1305 (`BETTER_AUTH_SECRET`, géré par Better Auth, voir `better-auth/crypto`) — secret TOTP et code de secours, jamais en clair en base                                                                                                             |
| Codes email       | base32 sans ambiguïté, 8 caractères, 10 minutes, une demande vivante par compte                                                                                                                                                                                  |
| Énumération       | les messages d'erreur ne distinguent pas « compte inconnu » de « mot de passe invalide »                                                                                                                                                                         |
| Données au client | `locals.user` reste serveur ; `+layout.server.ts` n'expose qu'une projection explicite, sans secret                                                                                                                                                              |

### Quotas

Les compteurs utilisent Redis (Upstash) quand `UPSTASH_REDIS_REST_URL` /
`UPSTASH_REDIS_REST_TOKEN` sont renseignées — un script Lua par algorithme
garantit l'atomicité, partagée entre toutes les instances. Sans ces variables
(dev local sans compte Upstash), repli automatique sur une `Map` en mémoire de
process, comme avant : chaque instance applique alors son propre quota, réparti
sur le nombre d'instances actives en production (voir `src/lib/server/redis.ts`,
`src/lib/server/rate-limit.ts`).

| Point d'entrée                    | Clé              | Quota                                                   |
| --------------------------------- | ---------------- | ------------------------------------------------------- |
| toutes les requêtes               | IP               | 100 par seconde                                         |
| inscription                       | IP               | 3 jetons, 1 rechargé toutes les 10 s                    |
| connexion                         | IP               | 20 jetons, 1 rechargé par seconde                       |
| connexion                         | compte           | délai croissant : 0, 1, 2, 4, 8, 16, 30, 60, 180, 300 s |
| mot de passe oublié               | IP et compte     | 3 jetons, 1 rechargé par minute                         |
| saisie du code email              | compte           | 5 essais par 30 min                                     |
| envoi d'un code email             | compte           | 3 envois par 10 min                                     |
| saisie du code (réinitialisation) | session de reset | 5 essais par 30 min                                     |
| changement de mot de passe        | compte           | 5 par 30 min                                            |
| configuration 2FA                 | compte           | 3 jetons, 1 rechargé toutes les 10 min                  |
| code TOTP (après connexion)       | IP               | 5 essais par 30 min — identité connue de Better Auth seul (cookie « two_factor »), voir MIGRATION_BETTER_AUTH.md §12 |
| code de secours (après connexion) | IP               | 3 essais par heure — même raison                        |
| code TOTP (réinitialisation)      | session de reset | 5 essais par 30 min                                     |
| code de secours (réinitialisation)| session de reset | 3 essais par heure                                      |

## Configuration

| Variable                                             | Rôle                                                                                            | Obligatoire                                                  |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `BETTER_AUTH_SECRET`                                 | secret de signature des cookies + chiffrement des secrets 2FA (XChaCha20-Poly1305)              | oui                                                           |
| `SMTP_HOST`, `SMTP_PORT`                             | serveur d'envoi des codes                                                                       | oui                                                          |
| `SMTP_USER`, `SMTP_PASS`                             | authentification SMTP                                                                           | selon le serveur                                             |
| `GOOGLE_CLIENT_ID`                                   | identifiant OAuth Google                                                                        | si Google activé                                             |
| `GOOGLE_CLIENT_SECRET`                               | secret OAuth Google                                                                             | si Google activé                                             |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | quotas partagés entre instances (voir Quotas)                                                   | non (repli mémoire)                                          |

`BETTER_AUTH_SECRET` est à sauvegarder comme un mot de passe de base de
données : le perdre invalide toutes les sessions ouvertes et rend
indéchiffrables tous les secrets 2FA déjà configurés, qu'il faudrait alors
reconfigurer compte par compte. Distinct de l'ancien `ENCRYPTION_KEY`
(retiré avec Lucia) : ne jamais réutiliser la même valeur par commodité, ce
sont deux secrets avec des portées différentes. Procédure de rotation :
[docs/secrets-rotation.md](../secrets-rotation.md).

**Google Cloud Console** : l'URI de redirection autorisée doit pointer vers
`<domaine>/api/auth/callback/google` (plus `<domaine>/auth/login/google/
callback`, la route maison d'avant la migration) — à corriger manuellement
dans la console avant le déploiement, Better Auth ne peut pas le faire à
notre place.

Un échec d'envoi d'email n'interrompt pas l'inscription : le compte est créé et le
code reste consultable en base pendant sa durée de validité.

## Tests

Le scénario principal : `e2e/auth/journey.spec.ts`. Les numéros ci-dessous
sont ceux des `test.step`. Pour changer la procédure : cette liste → le step
du spec → le code sous `/auth`. Détail (limiteurs, `fillStable`, hors
périmètre) : [../../e2e/README.md](../../e2e/README.md).

Neuf autres specs couvrent chacune un flux distinct, non repris dans le
tableau (un scénario dédié par flux plutôt que des étapes supplémentaires
dans `journey.spec.ts`) : `google.spec.ts` (connexion Google), `address.spec.ts`
(carnet d'adresses), `new-device-alert.spec.ts` (alerte nouvel appareil +
« Ce n'était pas moi »), `sessions.spec.ts` (sessions actives self-service),
`password-changed-alert.spec.ts`, `gdpr-data.spec.ts` (export + anonymisation),
`failed-login-alert.spec.ts` — ces sept couvrent la sous-section « Sécurité
du compte et RGPD self-service » ci-dessus — plus `settings.spec.ts`
(`marketingEmailsOptIn` : anonyme redirigé, défaut `false`, bascule et
retour) et `reset-password-2fa.spec.ts` (réinitialisation de mot de passe
sur un compte 2FA active, code TOTP et code de récupération).

| #   | Étape                                        | Refusé                                 | Accepté                                  |
| --- | -------------------------------------------- | -------------------------------------- | ----------------------------------------- |
| 1   | Pages protégées fermées aux anonymes         | 9 routes `GUARDED_PAGES`               | redirection login / forgot-password       |
| 2   | Inscription : saisies invalides              | pseudo court, email HTML, 5 règles MDP | pas de session                            |
| 3   | Inscription : compte créé, non vérifié       | —                                      | hash argon (`AuthAccount`), `emailVerified=false` |
| 4   | Vérif email : codes invalides                | trop court, inexistant                 | toujours non vérifié                      |
| 5   | Vérif email : renvoi invalide l'ancien code  | ancien code                            | nouveau code → `/auth`                    |
| 6   | MDP : courant erroné                         | trop court, courant faux               | hash inchangé                             |
| 7   | MDP : changement révoque les autres sessions | —                                      | 1 session (`auth.api.changePassword`)     |
| 8   | Connexion : identifiants erronés             | inconnu, ancien MDP, MDP faux          | pas de cookie                             |
| 9   | Connexion : nouveau MDP accepté              | —                                      | `/`                                       |
| 10  | Email déjà pris                              | adresse occupée                        | email inchangé                            |
| 11  | Email changé après le code                   | avant le code, encore l'ancien         | code sur la **nouvelle** adresse          |
| 12  | MDP oublié : demande / code invalides        | inconnu, code faux, GET reset          | reste sur verify                          |
| 13  | MDP oublié : bon code                        | MDP trop court                         | réinitialisé, **0 session → `/auth/login`** (voir « Mot de passe oublié ») |
| 14  | 2FA setup invalide                           | TOTP court / faux                      | `TwoFactor` absent (pas configurée)       |
| 15  | 2FA configurée + code de secours             | —                                      | code UI = base déchiffrée                 |
| 16  | Connexion : second facteur requis            | TOTP faux                              | code valide → session créée → `/auth`     |
| 17  | Code de secours (connexion)                  | trop court, faux                       | 2FA retirée, session créée puis `/auth/2fa/setup` |
| 18  | Reconfig 2FA puis déconnexion                | TOTP sur clé périmée                   | 0 session, `/auth/` → login               |

Test à part : déconnexion depuis le tiroir panier — cookie absent, 0 session,
GET `/auth/settings` → login.

```bash
npm run test:e2e          # exécution simple
npm run test:e2e:video    # avec vidéo du parcours
```

## Étendre le module

**Protéger une nouvelle route.** Lire `locals.user` dans son `load` et rediriger
si absent. Pour un espace entier, préférer un préfixe traité dans `authHandle`,
comme `/auth/settings`, afin que l'oubli d'une garde sur une page ne crée pas de
faille.

**Ajouter un fournisseur OAuth.** Déclarer le provider dans
`socialProviders` (`src/lib/auth/index.ts`, voir la doc Better Auth pour la
liste des fournisseurs intégrés) ; le bouton (sur le modèle de
`signInWithGoogle`, `src/lib/auth/client.ts` + `+page.svelte` de
`/auth/login`/`/auth/signup`) appelle `authClient.signIn.social({ provider:
'<id>' })`. Better Auth monte lui-même les routes de départ/callback sous
`/api/auth/**` — rien à écrire côté SvelteKit pour ça.

**Ajouter un champ au compte.** Étendre le modèle Prisma (`User`), puis
`user.additionalFields` (`src/lib/auth/index.ts`) pour que Better Auth le
lise/l'écrive, puis le type `User` et `toLocalsUser()`
(`src/lib/auth/user.ts`). Si le champ doit être visible côté client,
l'ajouter explicitement dans `src/routes/+layout.server.ts` — la projection
y est volontairement manuelle pour éviter toute fuite.

**Changer la durée des sessions.** Deux options dans `session`
(`src/lib/auth/index.ts`) : `expiresIn` (durée totale) et `updateAge` (seuil
de prolongation automatique, « glissante »).

## Limites connues

- **Une réinitialisation de mot de passe ne reconnecte jamais
  automatiquement** (voir « Mot de passe oublié » ci-dessus et
  `MIGRATION_BETTER_AUTH.md` §15) — différence de comportement assumée
  depuis la migration Better Auth, pas un défaut à corriger.
- `src/lib/lucia/` ne contient plus Lucia (voir la note en tête de ce
  document) — le nom du dossier n'a pas encore été corrigé, purement
  cosmétique.
- Plusieurs fonctions de `src/lib/prisma/user/user.ts` et la table Prisma
  `Session` (Lucia) restent en base/dans le code sans plus aucun appelant —
  à retirer définitivement une fois la suite e2e confirmée stable sur cette
  base (voir « Écarts restants » de `MIGRATION_BETTER_AUTH.md`).
- Les quotas ne sont pas partagés entre instances (voir ci-dessus).
- Le hook recharge l'utilisateur et la session via `auth.api.getSession` à
  chaque requête non mise en cache — un cache court (8 s, Redis si
  configuré) absorbe l'essentiel de la charge pour un visiteur qui navigue
  normalement (`SESSION_IDENTITY_CACHE_TTL_SECONDS`, `$lib/auth/hooks.ts`).
- Les emails partent en SMTP direct, sans file d'attente : un envoi lent ralentit
  la requête qui le déclenche.
- Les sessions et demandes expirées sont purgées par la tâche planifiée
  `/api/jobs/cleanup` (`$lib/server/jobs/cleanup.ts`), pas à la volée à
  chaque lecture.
