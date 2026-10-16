# Évolutions recommandées pour le projet SvelteKit

État examiné le 16 octobre 2026 à partir de `package.json`, de la configuration
SvelteKit, de la CI et de l'organisation de `src/`. Ce document est une feuille
de route : il ne signifie pas que les migrations proposées ont déjà été
réalisées.

## Priorités

### 1. Remplacer progressivement Lucia

**Priorité : haute.** Lucia v3 et son adaptateur Prisma sont utilisés dans
`src/lib/lucia/index.ts` pour la validation des sessions et les cookies. Lucia
est dépréciée ; cependant, le projet a déjà bâti autour d'elle un système
d'authentification métier conséquent (2FA, récupération de compte, OAuth Google,
alertes et révocation de sessions). Une migration doit donc préserver ce
comportement, et ne pas se limiter à remplacer un paquet.

Étapes recommandées :

1. Inventorier les contrats actuels : format et durée des cookies, création,
   validation, renouvellement et révocation des sessions, données exposées dans
   `event.locals`, 2FA et OAuth.
2. Isoler derrière une petite interface interne les opérations de session
   actuellement liées à Lucia, sans modifier le comportement visible.
3. Comparer une implémentation de sessions maison fondée sur les recommandations
   actuelles de Lucia avec une bibliothèque intégrée telle que Better Auth.
   Vérifier dans les deux cas la compatibilité avec Prisma, le modèle de données
   existant et les parcours métier avant de choisir.
4. Migrer par étapes, ajouter des tests de non-régression et documenter la
   procédure de déploiement et, si nécessaire, d'invalidation des sessions.
5. Supprimer `lucia` et `@lucia-auth/adapter-prisma` uniquement lorsque plus
   aucun code ne les utilise.

**Critères de validation :** les parcours d'inscription, connexion, déconnexion,
Google, 2FA, récupération de compte et révocation des sessions passent les tests
existants ; les cookies gardent les attributs de sécurité attendus ; aucun
compte ni session n'est perdu par surprise au déploiement.

Références : [annonce de dépréciation de Lucia](https://lucia-auth.com/),
[guide d'authentification de Lucia](https://auth.pilcrowonpaper.com/),
[intégration SvelteKit de Better Auth](https://www.better-auth.com/docs/integrations/svelte-kit).

### 2. Préparer la mise à niveau majeure de SvelteKit et de l'adapter Vercel

**Priorité : haute, après vérification des dépendances et de la plateforme.**
Au moment de l'examen, le projet déclare SvelteKit `^2.21.1`, Vite `^6.4.4`,
`@sveltejs/vite-plugin-svelte` `^5.0.3`, adapter-vercel `^6.3.4` et Svelte 5.
La configuration choisit aussi le runtime Vercel `nodejs20.x`, tandis que la CI
utilise Node 22.

Avant de mettre à niveau :

1. Vérifier les versions stables disponibles, les prérequis Node et les guides de
   migration officiels de SvelteKit, Vite, du plugin Svelte et de l'adapter
   Vercel. Traiter ces paquets comme un ensemble compatible, pas comme des mises
   à jour indépendantes.
2. Confirmer les runtimes réellement pris en charge par le compte et le plan
   Vercel. Aligner le runtime déclaré dans `svelte.config.js` et la version
   utilisée en CI ; ne pas augmenter le runtime avant cette confirmation.
3. Créer une branche dédiée et mettre à niveau progressivement en suivant les
   guides officiels.
4. Exécuter `npm ci`, `npm run check`, `npm run lint`, `npm run test:unit`,
   `npm run test:e2e` et `npm run build`.
5. Vérifier en préproduction le checkout Stripe, les webhooks, les tâches
   planifiées, les PDF, l'authentification, les cartes MapLibre et la politique
   CSP. Les durées de fonctions configurées pour Vercel doivent également être
   testées sur la plateforme cible.

**Critères de validation :** les versions installées sont compatibles entre
elles et avec le runtime de déploiement ; CI, build de production et parcours
critiques fonctionnent avant la mise en production.

Références : [guide officiel de migration SvelteKit](https://svelte.dev/docs/kit/migrating-to-sveltekit-2),
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
