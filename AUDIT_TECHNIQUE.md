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

| Axe                                   | Note actuelle                                | Ce qui manque pour "professionnel, pris au sérieux"                         |
| ------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------- |
| Architecture & modularité             | 🟢 Solide                                    | Rien de bloquant                                                            |
| Tests (unit + e2e + charge)           | 🟢 Solide                                    | Coverage non mesurée, `lint-and-check` CI énigmatique                       |
| Sécurité applicative                  | 🟡 Bonne base, un vrai trou trouvé et bouché | `npm audit` cassé, secrets `.env` en clair sur disque, pas de `SECURITY.md` |
| Qualité de code outillée (lint/types) | 🟡 En progrès mais non bloquant              | ESLint non-bloquant en CI depuis le début (109 erreurs dorment)             |
| Hygiène du dépôt                      | 🔴 Négligée jusqu'à cet audit                | Fichiers parasites commités, PWA fantôme, doc CI obsolète                   |
| Gouvernance / process                 | 🔴 Absente                                   | Pas de CONTRIBUTING, CODEOWNERS, Dependabot, SECURITY.md                    |

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
  contenu d'article, rédigé par un admin via TinyMCE. Acceptable dans le
  modèle de confiance actuel (admin = confiance totale), mais **candidat
  naturel à `dompurify`** (déjà en dépendance, jamais importé — voir §3.4)
  en défense en profondeur si un jour plusieurs rôles éditoriaux existent.

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

**a. `npm audit` est cassé, y compris en CI, sans que rien ne le signale.**
Reproduit en local : `npm audit --omit=dev --audit-level=high` renvoie une
erreur 400 de l'API npm ("This endpoint is being retired... Invalid package
tree") même après resynchronisation complète du lockfile. Le job CI
(`continue-on-error: true`) avale l'échec silencieusement — **le pipeline
affiche un audit "passé" alors qu'aucun scan n'a réellement eu lieu depuis
un moment indéterminé.** C'est un angle mort de sécurité classique : le faux
sentiment de couverture est pire que l'absence de couverture affichée.
→ Recommandation §4, priorité P0.

**b. Secrets en clair sur disque (`.env`, `.env.test`), sans chiffrement
au repos ni séparation d'accès.** Fonctionnel pour un solo/petite équipe,
mais ne passera pas une revue sécurité "vrai projet pris au sérieux" en
l'état dès qu'il y a plusieurs contributeurs ou un environnement partagé.
`docs/secrets-rotation.md` documente bien la _rotation_, mais pas le
_stockage_ (pas de Vault/1Password/Doppler/Vercel encrypted env mentionné).

**c. `lint-and-check` échoue en CI pour une raison non identifiée.**
Reproduit intégralement en local (Node 22, `npm ci` propre, `lint:prettier`,
`check`, `test:unit`) : les trois étapes bloquantes passent avec un code de
sortie 0. ESLint et l'audit sont `continue-on-error: true`, donc ne
devraient pas faire échouer le job. Sans accès aux logs bruts (page GitHub
demandant une authentification), impossible d'aller plus loin depuis cet
environnement. **Ouvert, à investiguer avec un accès authentifié.**

### 3.2 🟡 Qualité de code outillée — non bloquante, mais 109 erreurs qui dorment

ESLint est en `continue-on-error: true` en CI depuis sa mise en place —
aucune régression n'y est donc jamais bloquée. Répartition actuelle :

| Règle                                                                                                       | Occurrences | Gravité réelle                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@typescript-eslint/no-explicit-any`                                                                        | 65          | Dette de typage — érode la valeur du `strict: true` par ailleurs réel                                                                                                |
| `svelte/require-each-key`                                                                                   | 25          | Pas que du style : sans clé, Svelte peut réutiliser/désynchroniser des nœuds DOM sur réordonnancement → bugs d'affichage discrets                                    |
| `svelte/prefer-svelte-reactivity`                                                                           | 9           | `new Set()`/`new Map()` natifs dans du code réactif Svelte 5 → mutations qui ne déclenchent pas toujours de re-render. Risque de bug fonctionnel, pas juste de style |
| `svelte/prefer-writable-derived`                                                                            | 3           | Anti-pattern `$state` + `$effect` de synchronisation plutôt qu'un `$derived` écrivable (déjà documenté dans `/memories/repo/svelte5-effect-store-antipattern.md`)    |
| `@typescript-eslint/no-unused-vars`                                                                         | 2           | Mineur                                                                                                                                                               |
| `svelte/no-at-html-tags`                                                                                    | 2           | Voir §1.1 — les 2 restants évalués et acceptés                                                                                                                       |
| `@typescript-eslint/no-unused-expressions`, `no-constant-condition`, `svelte/valid-prop-names-in-kit-pages` | 1 chacun    | Mineur                                                                                                                                                               |

Les deux règles `prefer-svelte-reactivity` et `require-each-key` méritent
d'être requalifiées : ce ne sont **pas des erreurs de style**, ce sont des
bugs de réactivité latents en Svelte 5. Elles devraient passer bloquantes
avant `no-explicit-any`, qui est plus gros en volume mais moins dangereux à
l'exécution.

### 3.3 🟡 Documentation désynchronisée du code réel

Le [README.md](README.md) racine (section CI) affirme que `lint` et `check`
sont tous deux en `continue-on-error` — **faux** : `check` (svelte-check)
est bloquant depuis l'origine du fichier, seul `lint:eslint` (et l'audit)
sont non-bloquants. Le README **ne mentionne pas du tout** le job `e2e`
ajouté cette semaine (postgres jetable, 46 specs, entièrement mocké). Un
contributeur qui lit uniquement le README a une image fausse du filet de
sécurité réel du projet. → correction proposée en §4 (P0, 5 minutes).

### 3.4 🟢 Hygiène des dépendances — jamais auditée avant aujourd'hui

Premier passage `knip` (aucune config présente dans le dépôt, donc résultat
brut, à trier) :

- **30 dépendances de prod + 15 devDependencies potentiellement inutilisées**
  (ex. `argon2` doublon de `@node-rs/argon2` déjà utilisé ; `dompurify`
  jamais importé malgré un usage naturel identifié en §1.1 ; `date-fns`,
  `cmdk`, `input-otp`, `class-variance-authority`... à confirmer un par un,
  certains sont des faux positifs de dépendances transitives nécessaires au
  build — **ne pas supprimer en masse sans vérification individuelle**).
- **127 "fichiers inutilisés"** — à plus de 80 % du bruit attendu (composants
  shadcn-svelte scaffoldés mais pas tous consommés, `static/dev-sw.js` qui
  est en réalité un filet de sécurité HTTP légitime non détecté par l'analyse
  statique de knip — voir mémoire repo). Une poignée de vrais candidats à
  vérifier : `e2e/support/commerce.ts`, `src/lib/{blog,commerce,contact,products}/paths.ts`,
  `src/lib/schema/products/customSchema.ts`, `src/lib/store/mediaStore.ts`,
  `src/lib/utils/shippingMethodMap.ts`.
- Les scripts k6 (`k6/*.js`) sont signalés "inutilisés" à tort — knip ne
  connaît pas les scripts invoqués uniquement via le binaire `k6 run`
  (`npm run load:*`) : faux positif de configuration, pas un vrai problème.

**Aucune configuration `knip.json`/`.depcheckrc` n'existe** : cet audit n'a
jamais été fait de façon institutionnalisée avant aujourd'hui.

### 3.5 🟢 Gouvernance & process — absents

Aucun `CONTRIBUTING.md`, `SECURITY.md` (politique de signalement de
vulnérabilité), `CODEOWNERS`, ni configuration Dependabot/Renovate pour les
mises à jour de dépendances automatisées. Pour un projet "pris au sérieux",
ce sont des signaux attendus dès le premier contributeur externe ou audit
client.

---

## 4. Feuille de route priorisée

Priorisation par **risque réel × effort**, pas par ordre d'apparition.

### P0 — Cette semaine, effort faible, impact fort

1. **Remplacer `npm audit` par un scanner qui fonctionne réellement.**
   Deux options concrètes : (a) activer **Dependabot alerts** natif GitHub
   (gratuit, zéro maintenance, alertes directement dans l'onglet Security du
   repo) — recommandé en premier ; (b) en complément CI, `npm audit
--omit=dev` via la commande `npm audit signatures`/endpoint bulk, ou un
   outil dédié (`osv-scanner`). Ne pas laisser le step actuel en l'état : un
   scan qui échoue silencieusement est plus trompeur qu'un scan absent.
2. ~~Corriger la section CI du README~~ **fait** (§1.7).
3. ~~Ajouter un `SECURITY.md`~~ **fait** (§1.8) — à enrichir si besoin.
4. **Activer Dependabot** (`.github/dependabot.yml`) pour npm + GitHub
   Actions — PRs de mise à jour automatiques, faible bruit si bien
   configuré (groupé, hebdomadaire).
5. **Résoudre l'énigme `lint-and-check`** : demander l'accès au log brut
   authentifié (toi, dans l'onglet Actions) pour identifier l'étape qui
   échoue réellement — actuellement invisible depuis cet environnement.

### P1 — Prochaines itérations, effort moyen

6. **Rendre bloquantes les 2 règles ESLint les plus dangereuses**
   (`svelte/prefer-svelte-reactivity`, `svelte/require-each-key` — 34
   occurrences à elles deux) sans attendre d'avoir traité les 65
   `no-explicit-any`. Ce sont des bugs de réactivité potentiels, pas du
   style — les isoler du reste de la dette ESLint (override de règle par
   règle dans `eslint.config.js`, ou script `eslint --rule ...` dédié en CI)
   permet de les rendre bloquants sans attendre la résorption complète.
7. **Trancher le sort de `dompurify`** : soit l'utiliser réellement pour
   sanitiser `post.content` (blog, §1.1) en défense en profondeur, soit le
   retirer des dépendances s'il reste décidément hors scope.
8. **Passer `knip` en CI non-bloquant** (`continue-on-error`, comme l'audit
   au démarrage) avec une configuration (`knip.json`) qui exclut
   explicitement les faux positifs identifiés (scripts k6, `dev-sw.js`,
   composants shadcn volontairement scaffoldés) — sinon le bruit initial
   décourage de le garder. Traiter ensuite un par un les candidats réels
   listés en §3.4.
9. **Mesurer la couverture de tests unitaires** (`vitest --coverage`,
   provider `v8`) avec un seuil bas au départ (ex. 20-30 %) pour avoir un
   chiffre de référence et éviter la régression silencieuse, plutôt que de
   viser un seuil ambitieux dès le départ.
10. **Documenter le stockage des secrets** (pas seulement leur rotation) :
    au minimum une note sur l'usage des "Environment Variables" chiffrées
    de Vercel en prod, et une recommandation (Doppler/1Password/Vault) si
    l'équipe grandit.

### P2 — Structurant, effort plus élevé

11. **Résorber `no-explicit-any` par lots thématiques** (le fichier
    `Table.svelte` à lui seul en concentre 7 — un bon premier lot vu qu'il
    vient d'être touché pour la faille XSS).
12. **Ajouter `CONTRIBUTING.md` + `CODEOWNERS`** dès qu'un deuxième
    contributeur régulier rejoint le projet (pas urgent en solo, mais à
    anticiper plutôt que rétro-documenter après coup).

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

| Métrique                                                            | Valeur                                      |
| ------------------------------------------------------------------- | ------------------------------------------- |
| `npm run check`                                                     | 0 erreur, 0 warning                         |
| `npm run test:unit`                                                 | 24 tests passés, 2 skippés (8 fichiers)     |
| ESLint                                                              | 109 erreurs, 0 warning (non-bloquant en CI) |
| Specs Playwright                                                    | 46 fichiers                                 |
| Scripts de charge k6                                                | 4 (catalogue, login, admin, webhook)        |
| Dépendances prod / dev potentiellement inutilisées (knip, non trié) | 30 / 15                                     |
| `npm audit`                                                         | Non fonctionnel (erreur 400 endpoint)       |

---

_Prochaine mise à jour suggérée : après traitement des points P0, ou après
tout nouveau run CI significatif._
