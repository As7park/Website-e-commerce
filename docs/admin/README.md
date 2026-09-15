# Administration

Back-office du projet : tableau de bord, comptes, produits, blog, codes promo,
ventes et messages de contact. Réservé au rôle `ADMIN`.

Il est conçu pour être retirable d'un bloc. La procédure complète est dans
[retrait.md](./retrait.md) ; ce document décrit son fonctionnement.

## Frontière du module

| Emplacement         | Contenu                                                      |
| ------------------- | ------------------------------------------------------------ |
| `src/lib/admin/`    | gardes (`assertAdmin`, `requireAdmin`) et hook `adminHandle` |
| `src/routes/admin/` | pages du back-office                                         |

Le module s'accroche au reste du projet en **un seul point** : le hook
`adminHandle` (`src/lib/admin/hooks.ts`), branché dans `src/hooks.server.ts`
**après** `authHandle` (il lit `locals.user` et `locals.role`).

Partout ailleurs, une dépendance à l'administration est signalée par un
marqueur `ADMIN-PLUGIN`. La liste exhaustive s'obtient ainsi :

```bash
rg "ADMIN-PLUGIN" src/ prisma/
```

L'admin n'est **pas** un îlot autonome : c'est le CRUD de `User`, `Product`,
`PromoCode`, `BlogPost`, `ContactSubmission`, `Transaction`. Retirer les routes
ne supprime pas ces modèles ; il faut alors un autre outil pour les gérer
(Prisma Studio, CMS, autre back-office).

## Gardes d'accès

Trois couches, volontairement redondantes.

| Couche  | Où                                              | Comportement                                                          |
| ------- | ----------------------------------------------- | --------------------------------------------------------------------- |
| Hook    | `adminHandle`                                   | GET **et** POST sous `/admin` : anonyme → `/auth/login`, CLIENT → `/` |
| Layout  | `src/routes/admin/+layout.server.ts`            | même règle, plus une projection sûre de l'admin connecté              |
| Actions | `requireAdmin(locals)` en tête de chaque action | 403 si le rôle n'est pas `ADMIN`                                      |

SvelteKit n'exécute pas le `load` du layout avant une action : sans
`requireAdmin`, un POST `?/deleteUser` passerait même si chaque page vérifiait
le rôle au chargement. Le hook couvre déjà ce cas ; le helper reste pour le
jour où le hook serait retiré.

Toute nouvelle page sous `/admin` est protège par le hook et le layout. Toute
nouvelle **action** doit appeler `requireAdmin(locals)` en première ligne.

## Attribution du rôle

L'enum Prisma `Role` n'a que deux valeurs : `ADMIN` et `CLIENT` (défaut).

| Mécanisme                 | Effet                                                  |
| ------------------------- | ------------------------------------------------------ |
| Inscription / Google      | toujours `CLIENT`                                      |
| Seed                      | un compte `ADMIN` de démonstration (`prisma/seed.js`)  |
| Fiche `/admin/users/[id]` | promotion ou rétrogradation, valeurs d'enum uniquement |

Il n'existe pas de page de création de compte dans l'admin : les comptes
naissent par inscription.

## Sections

| Route             | Rôle                                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `/admin`          | tableau de bord (ventes récentes, dernières inscriptions)                                                              |
| `/admin/sales`    | transactions, factures, bordereaux                                                                                     |
| `/admin/users`    | liste et suppression ; fiche `[id]` pour rôle, 2FA, mot de passe, adresses                                             |
| `/admin/products` | catalogue et catégories                                                                                                |
| `/admin/blog`     | articles, catégories, tags                                                                                             |
| `/admin/promo`    | codes promo                                                                                                            |
| `/admin/contacts` | messages du formulaire de contact                                                                                      |
| `/admin/metrics`  | compteurs applicatifs (cache, rate-limit, jobs) en lecture seule                                                       |
| `/admin/exports`  | export CSV, purge ciblée par ancienneté, import (restauration) — ventes, utilisateurs, produits, blog, promo, contacts |
| `/admin/settings` | activation des modules e-commerce optionnels (voir ci-dessous)                                                         |

Les listes d'utilisateurs n'exposent jamais `passwordHash`, `totpKey` ni
`recoveryCode`.

### Purge depuis `/admin/exports`

Purge manuelle, déclenchée par un admin, ciblée par ancienneté (`createdAt`) —
jamais un vidage total de table. Complète, sans le remplacer, le job
automatique `$lib/server/jobs/cleanup.ts` (qui purge déjà, sans action admin,
les sessions expirées et les paniers `PENDING` abandonnés depuis 30 jours).

Les ventes (`Transaction`) sont l'exception à la règle "jamais purgé"
documentée dans `cleanup.ts` : purgeables ici, mais seulement avec une
confirmation renforcée (taper `SUPPRIMER`), décision explicite assumée pour
cette page uniquement — `cleanup.ts` continue de ne jamais y toucher
automatiquement. Les utilisateurs ne sont purgeables que s'ils n'ont jamais
vérifié leur email (filtre non désactivable depuis l'UI). `products`/`users`
liés à une commande existante (contrainte FK `Restrict`) sont ignorés plutôt
que de faire échouer toute la purge.

L'import restaure les colonnes exportées uniquement : jamais les secrets
(`passwordHash`, `totpKey`), jamais les relations profondes (tags et
commentaires de blog). Indisponible pour les ventes.

### Modules e-commerce optionnels — `/admin/settings`

Cinq modules de la roadmap post-audit sont derrière un interrupteur plutôt
qu'activés en dur : liste d'envies, ventes croisées, espace retour/SAV,
moyen de paiement enregistré, palier de fidélité. Réglage unique
(`StoreSettings`, ligne `id = "singleton"`, `$lib/server/storeSettings.ts`),
lu par chaque route publique concernée — un module désactivé ne se contente
pas d'être masqué à l'écran, sa route reste fermée (ex. `/auth/settings/wishlist`
répond 404, `POST /api/wishlist` répond 404) : un accès direct à l'URL ne
contourne pas l'interrupteur.

Lecture mise en cache 30 s (même mécanisme que le catalogue,
`$lib/server/cache.ts`, `bumpCacheVersion('settings')` à chaque sauvegarde) —
une modification depuis `/admin/settings` peut donc mettre jusqu'à 30 s à se
répercuter partout sans Redis pour invalider immédiatement. `/admin/settings`
lui-même lit toujours la valeur non mise en cache.

Au 15/09/2026, deux modules ont une implémentation complète derrière leur
interrupteur (liste d'envies, ventes croisées) ; les trois autres attendent
encore leur tour sur la roadmap.

### Alerting

`$lib/server/alerting.ts` (`reportIfRepeated`) complète les compteurs de
`/admin/metrics` : quand un signal lié à la charge dépasse un seuil dans une
fenêtre glissante, il déclenche un `Sentry.captureMessage` (tag
`alert:<clé>`) en plus d'un log `ERROR` — une seule alerte par fenêtre, pas à
chaque occurrence. Deux signaux instrumentés :

- `http-5xx` : 20+ réponses ≥500 en 1 minute (`errorRateTracking` dans
  `hooks.server.ts`, compteur `http.5xx`).
- `lock-contention` : 20+ échecs d'acquisition de verrou distribué en 5
  minutes, tous verrous confondus (`withLock` dans `$lib/server/lock.ts`,
  compteur `lock.contention`).

Ce n'est pas un remplacement d'un outil d'alerting dédié (PagerDuty/Slack) :
c'est ce que Sentry peut exploiter sans infrastructure supplémentaire —
configurer une règle d'alerte Sentry sur le tag `alert:*` pour être notifié
en dehors du dashboard `/admin/metrics`.

## Ce qui n'est pas l'admin

L'authentification (`/auth`, sessions, 2FA) et le tunnel de commande
(`/checkout`) sont des modules distincts. Le catalogue public (`/products`)
est documenté à part : [docs/products](../products/README.md). Le blog public
(`/blog`) et son CRUD : [docs/blog](../blog/README.md). Les ventes
(`/admin/sales`) sont la surface admin du commerce :
[docs/commerce](../commerce/README.md). Un administrateur
qui n'a pas validé sa 2FA est d'abord renvoyé vers `/auth/2fa` par `authHandle`,
avant même d'atteindre `/admin`.

## Tests

Les numéros sont ceux des `test.step`. Changer la procédure ici, puis le spec,
puis le code. Index commun : [../../e2e/README.md](../../e2e/README.md).

### Accès — `e2e/admin/security.spec.ts`

Routes : `ADMIN_PATHS` dans `e2e/support/admin.ts`.

| #   | Étape                          | Geste                                           | Preuve                |
| --- | ------------------------------ | ----------------------------------------------- | --------------------- |
| 1   | Anonyme renvoyé à la connexion | GET chaque path                                 | `/auth/login`         |
| 2   | CLIENT renvoyé à l’accueil     | inscription + GET                               | `/`                   |
| 3   | CLIENT ne mute pas             | POST `?/deleteUser`, `?/deletePromo`            | lignes encore en base |
| 4   | ADMIN entre                    | `promoteToAdmin` + GET `/admin`, `/admin/users` | titres visibles       |

### Utilisateurs — `e2e/admin/users.spec.ts`

| #   | Étape                    | Geste                | Preuve                                     |
| --- | ------------------------ | -------------------- | ------------------------------------------ |
| 1   | Liste sans secret        | recherche emails     | 3 cellules ; pas de hash / totp / recovery |
| 2   | Promotion CLIENT → ADMIN | fiche → ADMIN → Save | `role` en base                             |
| 3   | Rôle hors enum refusé    | POST `SUPERUSER`     | reste `CLIENT`                             |
| 4   | MFA depuis la fiche      | checkbox + Save      | `isMfaEnabled`                             |
| 5   | Suppression d’un CLIENT  | dialogue Continue    | disparu UI + base                          |

À part : CLIENT GET `/admin/users/:id` d'un autre compte → `/`.

### Modules e-commerce — `e2e/admin/settings.spec.ts`

| #   | Étape                                 | Geste                 | Preuve                   |
| --- | ------------------------------------- | --------------------- | ------------------------ |
| 1   | Modules désactivés au départ          | GET `/admin/settings` | 5 switches à `unchecked` |
| 2   | Activation d'un module                | switch + Enregistrer  | `StoreSettings` en base  |
| 3   | Rechargée, l'état enregistré persiste | reload                | switch reflète la base   |

À part : CLIENT POST `/admin/settings` — réglages inchangés.

### Exports — `e2e/admin/exports.spec.ts`

Purge jouée sur `products`, seuil 365 jours, lignes de test vieillies de 400 jours.

| #   | Étape                                  | Geste                         | Preuve                                 |
| --- | -------------------------------------- | ----------------------------- | -------------------------------------- |
| 1   | Export CSV                             | GET `/admin/exports/products` | en-tête + ligne attendues              |
| 2   | Aperçu de purge                        | Prévisualiser                 | delta +2 sur le compte                 |
| 3   | Purge ciblée, FK protégée ignorée      | Confirmer la suppression      | `1 supprimée(s), 1 ignorée(s)`         |
| 4   | Réimport met à jour une ligne modifiée | Importer                      | `0 créé(s), 1 mis à jour`, prix changé |

Blocage anonyme/CLIENT couvert par `ADMIN_PATHS` (`e2e/admin/security.spec.ts`).

Catalogue admin : [docs/products](../products/README.md). Ventes :
[docs/commerce](../commerce/README.md). Blog : [docs/blog](../blog/README.md).
Promo : [docs/promo](../promo/README.md). Contact : [docs/contact](../contact/README.md).

```bash
npm run test:e2e
```

## Étendre le module

**Ajouter une page.** La placer sous `src/routes/admin/`. Le hook et le layout
s'en chargent. Si elle a une action, appeler `requireAdmin(locals)` en premier.

**Ajouter un lien d'entrée.** Marquer `ADMIN-PLUGIN` (panier, page compte, etc.)
et ne l'afficher que si `role === 'ADMIN'`.
