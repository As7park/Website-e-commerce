# Audit technique & feuille de route — Boilerplate-Ecommerce-1

Document vivant : bilan factuel de l'état du dépôt (vérifié en exécutant les
outils, pas en le devinant), corrections déjà appliquées pendant cet audit,
et direction priorisée pour la suite. À mettre à jour à chaque point
d'étape plutôt qu'à réécrire de zéro.

**Méthode** : chaque constat de ce document a été vérifié en conditions
réelles (exécution de `npm run check`, `eslint`, `knip`, `npm audit`,
lecture directe du code et de l'historique git) — pas d'extrapolation à
partir de la seule documentation.

---

## 0. Résumé exécutif

Ce boilerplate est **nettement au-dessus du niveau habituel d'un starter** :
architecture "plugin" documentée (chaque module a un `README.md` +
`retrait.md`), SLOs chiffrés adossés à des scripts de charge k6, disjoncteur

- file dead-letter pour la résilience Sendcloud, audit log admin, rotation
  des secrets documentée, purge RGPD automatisée, 46 specs Playwright + CI
  e2e complète sans le moindre secret réel. Ce n'est pas un squelette vide :
  c'est un socle qui a déjà survécu à plusieurs audits internes (traces dans
  `docs/` et dans l'historique de commits).

Mais un vrai projet pris au sérieux se juge aussi sur ce qu'il laisse
traîner. Cet audit a trouvé et corrigé **une vraie faille XSS**, **deux bugs
de fond silencieux** (migration cassée à froid, requête SQL qui échouait
hors Neon), **des fichiers accidentels commités** (dont un contenant une
transcription de conversation), **une intégration PWA jamais réellement
active** malgré une config qui laissait croire le contraire, et confirmé que
**le scan de vulnérabilités npm est cassé en silence**, y compris en CI.

| Axe                                   | Note actuelle                                             | Ce qui manque pour "professionnel, pris au sérieux"                                                                                                                           |
| ------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture & modularité             | 🟢 Solide                                                 | Rien de bloquant                                                                                                                                                              |
| Tests (unit + e2e + charge)           | 🟢 Solide                                                 | Coverage Vitest mesurée (6,94 % lignes) mais trompeuse isolément — la majorité du parcours utilisateur est couverte par les 46 specs Playwright, non incluses dans ce chiffre |
| Sécurité applicative                  | 🟢 Trou réel bouché, scan de vulnérabilités remis en état | Secrets `.env` en clair sur disque (non chiffrés au repos)                                                                                                                    |
| Qualité de code outillée (lint/types) | � Bloquant sur les bugs de réactivité, warn sur le reste  | 6 warnings résiduels justifiés (`no-explicit-any`, `no-at-html-tags`)                                                                                                         |
| Hygiène du dépôt                      | 🟢 Assainie pendant cet audit                             | Rien de bloquant                                                                                                                                                              |
| Gouvernance / process                 | � CONTRIBUTING/CODEOWNERS/SECURITY.md/Dependabot en place | Activer "Dependabot alerts" dans les réglages GitHub (action manuelle admin)                                                                                                  |

---

## 1. Corrections appliquées pendant cet audit

Tout ce qui suit a été vérifié par exécution réelle (pas seulement lu), et
est déjà appliqué dans l'arbre de travail actuel.

### 1.1 🔴 Faille XSS réelle — `{@html}` non échappé dans le composant `Table`

**Fichier** : [src/lib/components/Table.svelte](src/lib/components/Table.svelte)
(utilisé par 13 pages admin : produits, contacts, avis, questions, cartes
cadeaux, promo, ventes, utilisateurs, factures...).

La colonne spéciale `images` faisait `{@html item[column.key]}` sur une
chaîne HTML construite par concaténation :

```ts
// src/routes/admin/products/+page.svelte (AVANT)
images: `<img class='w-20 h-20' src='${optimizedImageUrl(...)}' alt='${product.name}' />`,
```

`product.name` était interpolé **sans échappement** dans un attribut HTML.
Aujourd'hui le nom de produit est admin-only donc l'exploitation immédiate
est limitée (self-XSS d'un admin sur ses propres données), mais c'est un
pattern dangereux par construction : la moindre apostrophe dans un nom de
produit (`L'Éternité`) casse déjà le markup, et le jour où un champ texte
similaire est exposé à un rôle moins fiable (avis client, question produit,
contact — tous rendus par ce **même composant partagé**), c'est une XSS
stockée exploitable contre un compte admin.

**Corrigé** : suppression totale du `{@html}` sur ce chemin, remplacé par un
vrai `<img>` templaté (échappement automatique Svelte) :

```svelte
{#if column.key === 'images'}
  {@const image = item[column.key] as { src: string; alt: string } | undefined}
  {#if image}<img class="h-20 w-20" src={image.src} alt={image.alt} />{/if}
{/if}
```

Corrigé aux deux endroits où le composant duplique ce rendu (vue tableau
desktop **et** vue cartes mobile). Réduit aussi la dette ESLint
(`svelte/no-at-html-tags` : 4 → 2 occurrences restantes, voir §3.2).

**Deux `{@html}` restants, évalués et acceptés en l'état** :

- [src/routes/auth/2fa/setup/+page.svelte#L39](src/routes/auth/2fa/setup/+page.svelte) —
  QR code SVG généré côté serveur (`uqr`), pas de donnée utilisateur. Faible risque.
- [src/routes/blog/\[slug\]/+page.svelte#L36](src/routes/blog/%5Bslug%5D/+page.svelte) —
  contenu d'article, rédigé par un admin via TinyMCE. **Fait (P1 #7)** :
  sanitizé à l'écriture via `sanitizeBlogHtml()` (`src/lib/server/sanitizeHtml.ts`,
  DOMPurify + jsdom, 4 tests unitaires) dans `createPost`/`updatePost`
  (`src/lib/prisma/blogPost/blogPost.ts`) — défense en profondeur en cas de
  compromission d'un compte admin ou de futurs rôles éditoriaux moins fiables.

### 1.2 🟡 Bug de fond — `backdateOrder()` supposait un schéma `e2e` en dur

Voir détail dans `/memories/repo/e2e-testing-notes.md`. Le SQL brut de test
qualifiait la table `"e2e"."orders"` en dur ; ça ne casse que sur une base
sans le paramètre `schema=e2e` (typiquement une CI qui tourne sur un
Postgres jetable) — jamais vu en local car Neon a toujours ce paramètre.
Trouvé au premier run réel de la CI e2e (5 échecs Playwright). **Corrigé** :
schéma déduit dynamiquement de `DATABASE_URL`, validé par regex, injecté via
`Prisma.raw()`. Revalidé contre Postgres sans schéma **et** contre Neon réel.

### 1.3 🟡 Migration cassée à froid — ordre des migrations Prisma

Deux dossiers de migration mal ordonnés (`ALTER TABLE` avant le `CREATE
TABLE` dont il dépend) : invisible sur Neon dev/e2e (jamais rejouées depuis
zéro), mais **`prisma migrate deploy` échoue à 100 % sur toute base neuve**
(CI, nouvel environnement, disaster recovery). Corrigé par renommage du
dossier + mise à jour de `_prisma_migrations` sur les deux bases concernées.
Revalidé : 36/36 migrations OK depuis zéro.

### 1.4 🟡 Intégration PWA jamais réellement active

`VitePWA(...)` était déclaré dans `svelte.config.js` sous une clé `plugins:`
qui **n'existe pas** dans le schéma de config SvelteKit — jamais injecté
dans le pipeline Vite réel (`vite.config.ts` ne le référence nulle part).
Résultat : aucun service worker généré, aucun cache Workbox, malgré une
config qui affirmait le contraire (y compris dans `docs/deployment/README.md`,
qui prétendait le cache Cloudinary actif). Le contenu du `manifest:` était
resté au stade placeholder du starter (`"Mon App SvelteKit PWA"`, `icons: []`)
— preuve que ce n'était qu'un scaffolding jamais terminé, pas une
fonctionnalité voulue. **Supprimé** proprement : `static/sw.js`,
`static/site.webmanifest` (doublon orphelin du vrai manifeste utilisé,
`static/pwa/manifest.webmanifest`, conservé car réellement lié et
fonctionnel), dépendance `vite-plugin-pwa`, et la mention erronée dans la doc
de déploiement.

### 1.5 🔴 Fichiers parasites à la racine, dont un commité en historique git

Quatre fichiers issus de commandes shell mal terminées (redirections
accidentelles) traînaient à la racine :

- `test` — **commité** dans l'historique git (commit `b015e4e`), contenait
  une transcription de session d'assistant IA ("Bilan complet de la
  situation Sendcloud..."). Signal net de manque de vigilance avant commit.
- `t prisma = new PrismaClient();`, `ole.log(...)`, `aux | grep ...` — non
  trackés, contenaient respectivement une sortie `psql \dt` et deux captures
  d'aide du pager `less`.

**Supprimés** (le premier via `git rm`, les trois autres via `rm`).

### 1.6 Nettoyage de dette additionnel de cette session

- `npm uninstall vite-plugin-pwa` (dépendance devenue inutile).
- Recompte ESLint après corrections : **111 → 109 erreurs** (voir §3.2).

### 1.7 Documentation corrigée

- [README.md](README.md) section CI mise à jour : décrivait un seul job
  avec `lint`/`check` tous deux non-bloquants (faux — `check` est bloquant
  depuis l'origine) et ne mentionnait pas du tout le job `e2e`. Corrigé,
  et renvoi ajouté vers ce document.

### 1.8 Gouvernance — premier jalon

- Ajout d'un [SECURITY.md](SECURITY.md) minimal (contact, délai de réponse,
  périmètre, rappel des protections déjà en place).
- Vérifié : `test-results/` et `playwright-report/` sont déjà correctement
  dans `.gitignore` — le fichier parasite `test` (§1.5) est un accident
  isolé (nom non couvert par un pattern), pas un trou dans le `.gitignore`.

### 1.9 🔴 `npm audit` remplacé par un scan qui fonctionne réellement

Confirmé en §3.1.a : l'endpoint audit legacy de npm renvoie une erreur 400,
reproduit même après resynchronisation complète du lockfile — le step CI
(`continue-on-error: true`) avalait cet échec en silence depuis un moment
indéterminé. Remplacé par :

- **[.github/workflows/osv-scanner.yml](.github/workflows/osv-scanner.yml)**
  (nouveau) : action officielle Google, base [OSV.dev](https://osv.dev/),
  scan à chaque push sur `main` + hebdomadaire (lundi 06:30 UTC). Résultats
  publiés dans **Security → Code scanning** (visible sans creuser les logs
  d'un run), pas seulement dans la sortie d'un step CI. Volontairement
  `fail-on-vuln: false` pour ce premier run — à rendre bloquant une fois le
  bruit initial trié (même logique que le job `e2e` à sa création).
- **[.github/dependabot.yml](.github/dependabot.yml)** (nouveau) : PRs de
  mise à jour automatiques, groupées par type (prod/dev), hebdomadaires,
  majeures jamais groupées (pour ne pas masquer une régression dans un lot).
- L'ancien step `Audit (production dependencies)` retiré de
  [.github/workflows/ci.yml](.github/workflows/ci.yml).

**Action manuelle restante, hors de portée depuis cet environnement** :
activer **Dependabot alerts** (scan de vulnérabilités natif GitHub, distinct
des PRs de mise à jour ci-dessus) dans _Settings → Code security and
analysis_ du dépôt — c'est un réglage de repo, pas un fichier à committer,
seul un accès avec les droits d'administration du repo peut l'activer.

---

## 2. Ce qui est déjà solide (à ne pas casser en "améliorant")

Un audit honnête reconnaît aussi les bons choix déjà faits :

- **Architecture "plugin"** : chaque domaine (auth, admin, products, blog,
  commerce, promo, contact) a son `docs/<module>/README.md` **et** un
  `retrait.md` documentant comment le désinstaller proprement. C'est rare
  même dans des bases de code commerciales.
- **SLOs chiffrés et vérifiables** : [docs/commerce/slo.md](docs/commerce/slo.md)
  fixe des cibles p95/taux d'erreur par parcours, alignées avec les seuils
  réels des scripts [k6/](k6/) (`catalog.js`, `login.js`, `admin.js`,
  `webhook.js`) — pas un objectif théorique, un objectif testable.
- **Résilience tiers** : disjoncteur + file dead-letter pour Sendcloud
  (`$lib/server/circuit-breaker.ts`, `$lib/server/job-attempts.ts`) — un
  paiement ne bloque jamais sur une panne transporteur.
- **Sécurité déjà auditée à plusieurs reprises** (voir `/memories/repo/architecture.md`) :
  rate-limiter à namespace stable, migration AES-128→AES-256-GCM avec
  version de chiffrement explicite, CSP en rollout progressif
  (report-only → bloquant), pagination plafonnée partout, purge RGPD
  automatisée (sessions, tokens, commandes abandonnées), cache de session
  Redis avec invalidation au logout, logs structurés `pino` avec garde
  `DEBUG` (pas de PII en clair par défaut).
- **TypeScript strict** (`tsconfig.json` : `"strict": true`) — la dette
  `no-explicit-any` (§3.2) est un écart à une base déjà stricte, pas
  l'absence de rigueur.
- **Tests** : 46 specs Playwright (parcours complets : auth, admin, blog,
  commerce, contact, cartes cadeaux, produits, promo) + 8 fichiers de tests
  unitaires Vitest + 4 scénarios de charge k6. CI e2e ajoutée cette semaine,
  intégralement mockée (zéro secret réel requis).
- **Documentation de rotation des secrets** ([docs/secrets-rotation.md](docs/secrets-rotation.md)) —
  peu de projets à ce stade la formalisent.
- **Anti-injection SQL vérifié par construction** : 100 % des requêtes
  passent par Prisma paramétré (audit déjà réalisé, voir `docs/ameliorations-semaine-2026-09.md`).

---

## 3. Constats restants, par sévérité

### 3.1 🔴 Sécurité / fiabilité — à traiter en premier

**a. ~~`npm audit` est cassé, y compris en CI, sans que rien ne le signale.~~
Corrigé (§1.9).** Reproduit en local : `npm audit --omit=dev --audit-level=high`
renvoyait une erreur 400 de l'API npm ("This endpoint is being retired...
Invalid package tree") même après resynchronisation complète du lockfile. Le
job CI (`continue-on-error: true`) avalait l'échec silencieusement — le
pipeline affichait un audit "passé" alors qu'aucun scan n'avait réellement
eu lieu depuis un moment indéterminé. C'est un angle mort de sécurité
classique : le faux sentiment de couverture est pire que l'absence de
couverture affichée. Remplacé par OSV-Scanner + Dependabot (§1.9).

**b. Secrets en clair sur disque (`.env`, `.env.test`), sans chiffrement
au repos ni séparation d'accès.** Fonctionnel pour un solo/petite équipe,
mais ne passera pas une revue sécurité "vrai projet pris au sérieux" en
l'état dès qu'il y a plusieurs contributeurs ou un environnement partagé.
`docs/secrets-rotation.md` documente bien la _rotation_, mais pas le
_stockage_ (pas de Vault/1Password/Doppler/Vercel encrypted env mentionné).

**c. `lint-and-check` échouait en CI — cause identifiée et corrigée.**
Diagnostic obtenu via l'API GitHub REST publique (le dépôt est public :
`GET /repos/.../actions/jobs/{id}` donne le détail par étape sans
authentification), qui a permis d'isoler l'étape réellement en échec :
`Type-check (svelte-check)`, systématiquement, alors que `Lint (prettier)`
et `Lint (eslint)` passaient. Reproduit localement en déplaçant `.env`/
`.env.test` (simulant l'absence totale de variables d'environnement du job
`lint-and-check`, qui n'en définissait aucune contrairement au job `e2e`) :
`svelte-check` échoue avec 10 erreurs `Module "$env/static/private"|"$env/static/public" has no exported member '...'`
(`ENCRYPTION_KEY`, `GOOGLE_CLIENT_ID`, `PUBLIC_TINYMCE_API_KEY`...) — SvelteKit
ne génère les types de ces modules que pour les variables présentes au
moment de `svelte-kit sync`. **Corrigé** : ajout d'un bloc `env:` (valeurs
factices) au job `lint-and-check` dans `ci.yml`, reproduisant le fix déjà
appliqué au job `e2e`. Revérifié localement (0 erreur) avec ces mêmes
variables et sans `.env`.

### 3.2 � Qualité de code outillée — 2 règles réactivité désormais bloquantes en CI

**Fait (P1 #6)** : `eslint.config.js` rétrograde explicitement en `'warn'` les
règles non encore résorbées (`no-explicit-any`, `no-at-html-tags`) ;
`svelte/prefer-svelte-reactivity` et `svelte/require-each-key` restent en
`'error'` (défaut des presets) et le step CI "Lint (eslint)" n'a plus de
`continue-on-error`. **Mise à jour** : les 25 + 9 occurrences de ces deux
règles ont été corrigées (voir détail ci-dessous) ; `svelte/prefer-writable-derived`
a été résorbée puis explicitement promue en `'error'` dans `eslint.config.js`
— ce sont désormais les trois seules règles qui bloquent le build. Les
violations à 1-2 occurrences (`no-unused-vars`, `no-unused-expressions`,
`no-constant-condition`, `valid-prop-names-in-kit-pages`) ont été corrigées
directement plutôt que rétrogradées — 3 d'entre elles cachaient un vrai bug
(voir détail ci-dessous).

Répartition actuelle (après corrections) :

| Règle                                | Occurrences      | Statut CI                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@typescript-eslint/no-explicit-any` | 3                | `warn` — dette de typage, chantier P2 #11 **terminé** (lot 1 : `Table.svelte`, 65 → 59 ; lot 2 : Sendcloud/checkout + reliquat, 59 → 3, ne restent que les `icon: any` justifiés)                                                                                                                                              |
| `svelte/require-each-key`            | 0 (25 corrigées) | **`error`, bloquant** — **résorbé** : clé ajoutée à chacun des 25 `{#each}` (15 fichiers), la plus pertinente sémantiquement (id, url, href, label, clé de tuple...)                                                                                                                                                           |
| `svelte/prefer-svelte-reactivity`    | 0 (9 traitées)   | **`error`, bloquant** — **résorbé** : 2 occurrences (`Table.svelte`, sélection multi-lignes, état réactif réel) converties en `SvelteSet` ; 7 (`Map`/`URLSearchParams` locaux, construits et jetés dans une seule fonction) laissées natives avec `eslint-disable-next-line` justifié                                          |
| `svelte/prefer-writable-derived`     | 0 (3 corrigées)  | **`error`, bloquant** — **résorbé** : les 3 occurrences (`QuantityInput.svelte`, `blog/+page.svelte`, `products/+page.svelte`) remplaçaient un `$state` + `$effect` de resynchronisation par un simple `$derived` réassignable (writable derived, natif Svelte 5.25+) ; règle promue en `'error'` pour éviter toute régression |
| `svelte/no-at-html-tags`             | 3                | `warn` — 3 usages revus et acceptés (voir §1.1), dont un nouveau (`StructuredData.svelte`, JSON-LD)                                                                                                                                                                                                                            |

**Bugs réels découverts en corrigeant les violations à 1-2 occurrences** :

- `StructuredData.svelte` (`no-unused-vars`) : le JSON-LD (SEO) n'était
  **jamais rendu** — `{JSON.stringify(structuredData)}` à l'intérieur d'un
  `<script>` du template est parsé en RAWTEXT par Svelte, jamais interpolé.
  Corrigé en construisant la balise en JS et en l'injectant via `{@html}`
  (avec échappement `\u003c` des données).
- `+error.svelte` (`svelte/valid-prop-names-in-kit-pages`) : `export let
error` ne reçoit jamais rien de SvelteKit sur une page `+error.svelte` (pas
  un prop comme `data`) — le message d'erreur réel n'était jamais affiché.
  Corrigé avec `$page.error` (`$app/stores`).
- `auth/settings/+page.svelte` (`no-unused-vars`) : `isMfaEnabledEnhance`
  n'était référencé que dans un bloc de carte MFA actuellement commenté
  (feature volontairement masquée) — supprimé de la déstructuration.

### 3.3 � Documentation désynchronisée du code réel — corrigée

Le [README.md](README.md) (section CI) affirmait que `lint` et `check`
étaient tous deux en `continue-on-error`, et ne mentionnait pas le job
`e2e`. **Corrigé** : la section décrit désormais précisément le statut
bloquant/non-bloquant de chaque step (`eslint` bloquant sur les 3 règles
de réactivité, `warn` sur le reste ; `knip` non-bloquant ; job `e2e`
non-bloquant en première itération), alignée sur `ci.yml`.

### 3.4 🟢 Hygiène des dépendances — knip en CI (non-bloquant), dépendances triées

**Fait (P1 #8)** : `knip` installé (`devDependencies`), configuré via
[knip.json](knip.json). Exposé via `npm run lint:knip` et un step CI dédié
"Lint (knip)" en `continue-on-error: true`.

**Mise à jour — triage des 44 dépendances effectué** : chacune des 29
dépendances de prod + 15 devDependencies signalées a été vérifiée
individuellement (grep sur tout le repo + `npm ls <pkg> --all` pour détecter
un besoin transitif réel via un autre paquet directement utilisé) :

- **37 supprimées de `package.json`** (29 prod + 8 dev) : soit réellement
  mortes (ex. `argon2` remplacé depuis longtemps par `@node-rs/argon2`,
  `next-themes` — lib React sans rapport avec ce projet Svelte, `date-fns`,
  `mitt`, `cmdk`, `class-variance-authority`, `@fontsource/open-sans` alors
  que `@fontsource-variable/open-sans` est la variante réellement importée,
  les 4 plugins `@tailwindcss/{aspect-ratio,container-queries,forms,typography}`
  jamais référencés dans `tailwind.config.ts` ni en `@plugin` CSS...), soit
  déjà apportées transitivement par un paquet qu'on utilise directement
  (`@floating-ui/*`, `runed`, `svelte-toolbelt`, `tabbable`, `esm-env` par
  `bits-ui`/`vaul-svelte`/`paneforge` ; `@babel/runtime`, `core-js`, `raf`,
  `performance-now`, `fflate` par `jspdf`/`canvg` ; `fast-check`/`pure-rand`
  par `sveltekit-superforms`→`effect` ; `tslib` par de nombreux paquets) —
  déclaration redondante retirée, rien n'est perdu à l'exécution.
- **1 doublon retiré** : `prisma` était listé à la fois en `dependencies` et
  `devDependencies` (même version) — conservé uniquement en dev (CLI), le
  runtime est déjà couvert par `@prisma/client`.
- **`prettier-plugin-tailwindcss` supprimé** : installé mais jamais ajouté au
  tableau `plugins` de `.prettierrc` — donc sans aucun effet (le tri
  automatique des classes Tailwind ne s'est jamais exécuté). Retiré plutôt
  que branché à l'aveugle : l'activer réordonnerait les classes dans une
  bonne partie des fichiers `.svelte`, un changement délibéré à faire à part.
- **1 dépendance déclarée en plus** : `@eslint/js`, utilisée directement dans
  `eslint.config.js` mais absente de `package.json` (dépendance transitive
  d'`eslint-plugin-svelte`/`typescript-eslint` jusqu'ici) — désormais
  explicite en `devDependencies`.
- **6 faux positifs restants, dorénavant listés dans `knip.json` (`ignoreDependencies`)**
  plutôt que laissés comme bruit à chaque run : `@tanstack/table-core`,
  `embla-carousel-svelte`, `paneforge` (utilisés uniquement dans
  `src/lib/components/shadcn/ui/**`, exclu du scan de fichiers par
  `ignore` — leurs imports y sont donc invisibles pour knip) ; `chokidar`,
  `pino-pretty` (utilisés respectivement via un script npm et une chaîne
  dynamique `transport: { target: 'pino-pretty' }` dans `src/lib/server/log.ts`,
  pas un `import` statique que knip puisse détecter).
- **Effet de bord découvert en vérifiant par un vrai `npm run build`** :
  `eslint.config.js` n'ignorait ni `.vercel/` (sortie de build de
  l'adapter Vercel) ni `coverage/` (rapport de `vitest run --coverage`) —
  tous deux déjà exclus de git mais pas d'ESLint. Un build local ou un
  `--coverage` suivi d'un lint expose jusqu'à ~15 000 faux positifs sur du
  JS bundlé/généré. Corrigé (`ignores` étendu à `.vercel/` et `coverage/`) ;
  recompte final confirmé à 0 erreur / 6 warnings (baseline attendue).
- **8 fichiers potentiellement inutilisés restent signalés** (inchangé,
  hors périmètre de ce triage centré sur les dépendances) :
  `e2e/support/commerce.ts`, `src/lib/{blog,commerce,contact,products}/paths.ts`,
  `src/lib/schema/products/customSchema.ts`, `src/lib/store/mediaStore.ts`,
  `src/lib/utils/shippingMethodMap.ts`. **Pas encore supprimés** — à vérifier
  individuellement (import dynamique, référence dans un test, etc.) avant
  toute suppression, en gardant l'esprit "ne pas supprimer en masse".

Vérifié après triage : `npm install` (64 + 1 paquets transitifs retirés),
`npm run check` (0/0), `npm run build` (adapter Vercel, aucune régression),
`npx vitest run` (28 passed, 2 skipped), `npx knip` (0 dépendance non
utilisée, 0 dépendance non listée restante).

### 3.5 🟢 Gouvernance & process

`CONTRIBUTING.md`, `SECURITY.md` (politique de signalement de
vulnérabilité), `CODEOWNERS` et `.github/dependabot.yml` (mises à jour de
dépendances automatisées, groupées et hebdomadaires) sont en place. **Reste
un réglage GitHub, pas un fichier** : activer "Dependabot alerts" (Settings
→ Code security and analysis → Dependabot alerts) sur le dépôt — bascule
d'interface qu'un agent sans accès admin au dépôt ne peut pas actionner à la
place du mainteneur.

### 3.6 🟢 Coverage Vitest — mesurée

`npm run test:unit:coverage` (provider `v8`, config `vite.config.ts`) donne
6,94 % de lignes / 44,71 % de branches / 43,23 % de fonctions sur
l'ensemble de `src/**`. **Ce chiffre brut est trompeur pris isolément** :
il est tiré vers le bas par ~150 `+page.server.ts`/`+server.ts` (routes
SvelteKit) à 0 % — non pas parce qu'ils sont non testés, mais parce qu'ils
sont exercés par les 46 specs Playwright (`e2e/**`), que `vitest --coverage`
ne mesure pas. Les 9 fichiers de test unitaires existants ciblent
spécifiquement la logique la plus critique/complexe à isoler (chiffrement,
sanitization HTML, résilience Sendcloud, job post-paiement, génération de
facture) plutôt que de dupliquer ce que Playwright couvre déjà de bout en
bout. Aucun seuil (`thresholds`) n'est configuré — délibéré tant qu'un
premier chiffre de référence n'était pas mesuré (c'est fait ici) ; un seuil
combiné unit+e2e nécessiterait d'outiller la couverture Playwright
(`nyc`/`istanbul` via un provider dédié), hors périmètre de cet audit.

---

## 4. Feuille de route priorisée

Priorisation par **risque réel × effort**, pas par ordre d'apparition.

### P0 — Cette semaine, effort faible, impact fort

1. ~~Remplacer `npm audit` par un scanner qui fonctionne réellement.~~
   **fait** (§1.9) — `.github/workflows/osv-scanner.yml` (OSV-Scanner,
   résultats dans Security → Code scanning) + `.github/dependabot.yml`.
   Dependabot alerts déjà actif sur le dépôt (confirmé : 7 vulnérabilités
   détectées dès le premier push — 1 critique, 2 hautes, 3 modérées, 1
   basse — à trier).
2. ~~Corriger la section CI du README~~ **fait** (§1.7).
3. ~~Ajouter un `SECURITY.md`~~ **fait** (§1.8) — à enrichir si besoin.
4. ~~Activer Dependabot~~ **fait** (§1.9, `.github/dependabot.yml`) — PRs de
   mise à jour automatiques, groupées par type, hebdomadaires.
5. ~~Résoudre l'énigme `lint-and-check`~~ **fait** (§3.1.c) — variables
   d'environnement `$env/static/*` manquantes dans le job, `ci.yml` corrigé.

### P1 — Prochaines itérations, effort moyen (✅ toutes faites)

6. ~~**Rendre bloquantes les 2 règles ESLint les plus dangereuses**~~ **fait**
   (§3.2) : `svelte/prefer-svelte-reactivity` et `svelte/require-each-key`
   restent en `error` (défaut), le reste (`no-explicit-any`,
   `prefer-writable-derived`, `no-at-html-tags`) rétrogradé en `warn` dans
   `eslint.config.js`, `continue-on-error` retiré du step CI "Lint (eslint)".
7. ~~**Trancher le sort de `dompurify`**~~ **fait** (§1.1, §3.4) : utilisé
   réellement — `src/lib/server/sanitizeHtml.ts` (+ `jsdom`) sanitize
   `post.content` à l'écriture (`createPost`/`updatePost`), 4 tests unitaires.
8. ~~**Passer `knip` en CI non-bloquant**~~ **fait** (§3.4) : `knip.json`
   filtre les faux positifs connus, step CI "Lint (knip)" en
   `continue-on-error: true`. Candidats réels listés en §3.4 pour triage futur.
9. ~~**Mesurer la couverture de tests unitaires**~~ **fait** : `@vitest/coverage-v8`,
   `vite.config.ts` (`test.coverage`, provider `v8`, sans seuil actif),
   `npm run test:unit:coverage`, exécuté en CI (step "Unit tests"). Chiffre
   de référence mesuré : **~7 % de lignes** sur `src/**` (l'essentiel de la
   surface — routes SvelteKit — est couvert par les 46 specs e2e Playwright,
   pas par des tests unitaires ; seuls 9 fichiers ont des tests vitest à ce
   jour). Aucun seuil bloquant configuré volontairement — à réévaluer une
   fois plus de logique métier couverte.
10. ~~**Documenter le stockage des secrets**~~ **fait** :
    [docs/secrets-rotation.md](docs/secrets-rotation.md) a désormais une
    section "Stockage" (local `.env`, Vercel Environment Variables, absence
    de secret de dépôt GitHub Actions) avant la partie rotation, avec
    recommandation Doppler/1Password/Vault si l'équipe grandit.

### P2 — Structurant, effort plus élevé

11. ~~**Résorber `no-explicit-any` par lots thématiques**~~ **fait** —
    **lot 1** (`Table.svelte` et ses ~8 call sites) : 65 → 59 occurrences.
    `formatter`/`url`/`condition` typés `unknown`/`TableItem` au lieu de
    `any` (avec ajustement des call sites qui passaient des formatters/
    callbacks à signature trop stricte — `formatDate`, shapes ad-hoc
    `{ productSlug: string }`/`{ hasFacture?: boolean }` remplacées par
    `TableItem` + accès via propriété `unknown`, valide en template
    literal/`Boolean()` sans cast). **`icon` reste volontairement en
    `any`** (3 occurrences) : les icônes viennent soit de `lucide-svelte`
    (classes `SvelteComponentTyped`, API Svelte 4) soit de `@lucide/svelte`
    (composants fonction Svelte 5) — aucun type de composant Svelte natif
    ne couvre les deux sans passer par `any`, tenté puis abandonné (le
    type `Component` de `svelte` n'accepte pas les classes
    `SvelteComponentTyped` historiques).
    **lot 2** (le reste, 56 → 0) : domaine Sendcloud/checkout (41
    occurrences, `src/lib/sendcloud/{label,order,returnValidate}.ts`,
    `shipping-options`/`webhooks`/`webhooks/sendcloud` `+server.ts`,
    `post-payment.ts`, `AddressSelector.svelte`, `ShippingOptions.svelte`,
    `ServicePointMap.svelte`, `checkout/+page.svelte` — types locaux
    `SendcloudAnnounceResponse`/`SendcloudShippingOption`/
    `SendcloudReturnValidateResponse`/`SendcloudWebhookPayload` mirroring
    seulement les champs lus, DTOs partagés `ShippingOptionDTO`/
    `ServicePointDTO` dans `src/lib/sendcloud/checkoutTypes.ts`) puis les
    15 occurrences isolées restantes (`serializeData` rendu générique
    `<T>(obj: T): T` au lieu de `any`/`unknown` pour ne pas casser les
    appelants qui comptent sur la forme d'entrée, `updateOrderItems`/
    `saveCartForUser` typés via un nouveau `IncomingOrderItem`,
    `updateUserSecurity` via `Prisma.UserUpdateInput`, quelques
    annotations redondantes supprimées dans les pages admin taxonomies/
    blog/products). `npm run check` (0 erreur/0 warning), ESLint
    (`no-explicit-any` : 3 occurrences restantes, uniquement les `icon:
any` justifiés ci-dessus) et `npx vitest run` (28 tests passés, 2
    skippés) vérifiés après chaque lot.
12. ~~**Ajouter `CONTRIBUTING.md` + `CODEOWNERS`**~~ **fait** :
    [CONTRIBUTING.md](CONTRIBUTING.md) (setup, checks avant PR, conventions
    TS strict/Svelte 5/knip) + [CODEOWNERS](CODEOWNERS) (propriétaire
    global unique pour l'instant, à affiner par domaine dès un deuxième
    contributeur régulier).

### Ne pas faire (pour éviter l'over-engineering)

- Ne pas ré-implémenter une vraie PWA (service worker + cache offline) tant
  que personne ne l'a explicitement demandée comme fonctionnalité produit —
  la scaffolding morte a été retirée précisément pour éviter de maintenir
  une fausse promesse (voir §1.4).
- Ne pas supprimer en masse les 30+15 dépendances signalées par `knip` sans
  vérification individuelle — plusieurs sont probablement des faux positifs
  transitifs (voir §3.4).

---

## 5. Chiffres de référence (mesurés ce jour)

| Métrique                                                            | Valeur                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                                     | 0 erreur, 0 warning                                                                                                                                                                                                                                                                |
| `npm run test:unit`                                                 | 28 tests passés, 2 skippés (9 fichiers)                                                                                                                                                                                                                                            |
| ESLint                                                              | 0 erreur bloquante + 6 warnings justifiés (voir §3.2)                                                                                                                                                                                                                              |
| Coverage Vitest (`npm run test:unit:coverage`)                      | 6,94 % lignes / 44,71 % branches / 43,23 % fonctions — chiffre brut sur l'ensemble de `src/**`, dominé par les ~150 `+page.server.ts`/`+server.ts` non couverts en unitaire mais exercés par les 46 specs Playwright (non comptabilisées ici) ; pas de seuil configuré (voir §3.6) |
| Specs Playwright                                                    | 46 fichiers                                                                                                                                                                                                                                                                        |
| Scripts de charge k6                                                | 4 (catalogue, login, admin, webhook)                                                                                                                                                                                                                                               |
| Dépendances prod / dev potentiellement inutilisées (knip)           | 0 / 0 — 37 supprimées, 6 faux positifs justifiés en `ignoreDependencies` (voir §3.4) |
| Scan de vulnérabilités                                              | OSV-Scanner + Dependabot (`npm audit` retiré)                                                                                                                                                                                                                                      |

---

_Prochaine mise à jour suggérée : après traitement des points P0, ou après
tout nouveau run CI significatif._
