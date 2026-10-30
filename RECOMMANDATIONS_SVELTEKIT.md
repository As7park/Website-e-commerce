# Évolutions recommandées pour le projet SvelteKit

État examiné le 16 octobre 2026 à partir de `package.json`, de la configuration
SvelteKit, de la CI et de l'organisation de `src/`. Les statuts ci-dessous
séparent les changements effectués des validations qui restent à réaliser.

## Priorités

### 1. Migration Lucia → Better Auth — réalisée

**Statut : réalisée dans le code et les dépendances.** Better Auth est configuré
avec Prisma dans `src/lib/auth/index.ts` ; les parcours de session, Google et 2FA
ont été migrés, en conservant notamment les règles métier de récupération de
compte, de codes de secours, de rôles et d'alertes. Lucia et son adaptateur
Prisma ne sont plus déclarés dans `package.json`, et le schéma Prisma ne contient
plus l'ancien modèle `Session`.

Le détail des choix, étapes, tests et écarts de comportement documentés se trouve
dans [MIGRATION_BETTER_AUTH.md](./MIGRATION_BETTER_AUTH.md).

**À vérifier lors du déploiement en production :** la migration de base de
données est appliquée ; les utilisateurs ayant une 2FA existante la reconfigurent
conformément à la procédure prévue ; les utilisateurs se reconnectent après
l'invalidation des anciennes sessions. Cette feuille de route ne confirme pas à
elle seule l'état d'un déploiement production.

### 2. Mise à niveau majeure de SvelteKit et de l'adapter Vercel

**Statut : migration du code en cours ; validation complète bloquée.** Les
dépendances ont été mises à niveau vers SvelteKit 3.1, Vite 8, le plugin Svelte
7, TypeScript 6, Superforms 3 et adapter-vercel 7. Le runtime cible est
`nodejs22.x` ; Node 22.17 minimum est déclaré dans `package.json` et Node
22.22.0 est utilisé en CI.

Les changements de compatibilité déjà appliqués comprennent le déplacement de
la configuration dans `sveltekit.config.ts` et `vite.config.ts`, l'usage de
`$app/state` et `afterNavigate` à la place de `$app/stores`, la déclaration
explicite des variables d'environnement dans `src/env.ts` et la migration des
anciens alias vers les sous-chemins `#...` de `package.json#imports`.

**Validation locale :** `npm ci --ignore-scripts` et la compilation Vite des
modules passent. Le build complet et `npm run check` restent bloqués parce que
le client Prisma généré est absent ; `prisma generate` ne peut pas télécharger
son moteur dans cet environnement à cause d'une erreur de chaîne de certificats
TLS (`self-signed certificate in certificate chain`). Ne pas désactiver la
vérification TLS pour contourner ce blocage. Le contrôle TypeScript signale
également des incompatibilités Tailwind préexistantes dans `tailwind.config.ts`.

Avant de considérer la migration terminée :

1. Régénérer le client Prisma dans un environnement où la chaîne de certificats
   est approuvée, puis exécuter `npm run check`, `npm run lint`,
   `npm run test:unit`, `npm run test:e2e` et `npm run build`.
2. Vérifier en préproduction le checkout Stripe, les webhooks, les tâches
   planifiées, les PDF, l'authentification, les cartes MapLibre et la politique
   CSP. Tester aussi les durées de fonctions sur la plateforme Vercel cible.

**Critères de validation :** contrôle, tests, build et parcours critiques
réussissent avec le client Prisma généré ; le runtime Node 22 est vérifié sur
Vercel ; les smoke-tests préproduction sont concluants.

Références : [SvelteKit](https://svelte.dev/docs/kit),
[adapters SvelteKit](https://svelte.dev/docs/kit/adapters),
[adapter Vercel](https://svelte.dev/docs/kit/adapter-vercel).

## Améliorations facultatives

### 3. Tester certains composants Svelte isolément

Le projet dispose déjà de Vitest pour la logique et de Playwright, avec axe,
pour les parcours de bout en bout et l'accessibilité. Si certains composants
interactifs sont difficiles à couvrir sans lancer un parcours complet, évaluer
`@testing-library/svelte` pour tester leur comportement utilisateur au niveau
composant.

Ne pas ajouter cette dépendance par défaut : commencer par repérer des
composants partagés présentant un risque réel de régression, puis vérifier que
les tests unitaires existants ne couvrent pas déjà ce besoin. Garder Playwright
pour les parcours métier complets.

Références : [tests dans SvelteKit](https://svelte.dev/docs/kit/testing),
[Svelte Testing Library](https://testing-library.com/docs/svelte-testing-library/intro/).

### 4. Supprimer le doublon potentiel de bibliothèque d'icônes

`package.json` déclare `lucide-svelte` et `@lucide/svelte`. Les imports trouvés
dans les composants utilisent `lucide-svelte`. Vérifier les usages directs,
indirects et les fichiers générés de l'autre paquet, puis conserver un seul
paquet si l'autre est réellement inutilisé. Mettre à jour le lockfile avec le
gestionnaire de paquets et valider le build.

## Choix à conserver

- **Svelte 5** : déjà utilisé ; une autre bibliothèque de gestion d'état global
  n'est pas justifiée par les éléments examinés.
- **SvelteKit form actions, Superforms et Zod** : déjà présents pour les
  formulaires et leur validation. Ne pas ajouter une seconde solution de
  formulaires sans besoin distinct.
- **Bits UI et shadcn-svelte** : déjà présents pour les composants d'interface.
- **Vitest, Playwright et axe** : la base de tests est déjà en place.
- **Sentry et Pino** : l'observabilité et la journalisation sont déjà couvertes.

Pour les nouvelles fonctionnalités, privilégier les mécanismes natifs de
SvelteKit : chargement des données avec `load`, mutations avec les actions de
formulaire lorsque cela convient, et état serveur isolé par requête afin
d'éviter les fuites d'état entre utilisateurs en SSR.

Références : [chargement des données](https://svelte.dev/docs/kit/load),
[actions de formulaire](https://svelte.dev/docs/kit/form-actions),
[gestion de l'état](https://svelte.dev/docs/kit/state-management).
