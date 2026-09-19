# Rotation des secrets

Ce document couvre le **stockage** des secrets applicatifs, puis leur
**rotation** : `ENCRYPTION_KEY`, `STRIPE_SECRET_KEY`, les clés Sendcloud,
ainsi que les autres secrets de l'application selon le même schéma.

## Stockage

- **Local (dev)** : `.env`/`.env.test`, en clair sur disque, jamais commités
  (`.gitignore` : `.env`, `.env.*`, avec exceptions explicites `.env.example`
  et `.env.test.example` qui ne contiennent que des placeholders). Chaque
  développeur les recrée localement à partir de ces fichiers d'exemple.
  **Chiffrement au repos, gratuit** : le chiffrement disque de l'OS
  (FileVault/BitLocker/LUKS, souvent déjà actif par défaut) couvre déjà le
  scénario réaliste pour un solo (perte/vol de la machine) — combiné à
  `chmod 600 .env` (lecture réservée à l'utilisateur courant), pas d'outil
  supplémentaire nécessaire. Pour aller plus loin sans dépendre d'un
  service tiers, [`sops`](https://github.com/getsops/sops) +
  [`age`](https://github.com/FiloSottile/age) (tous deux open source,
  gratuits, sans compte) sont scaffoldés dans ce dépôt
  ([`.sops.yaml`](../.sops.yaml)) : ils chiffrent le `.env` valeur par
  valeur avec une clé `age` gardée hors du repo, permettant de committer
  `.env.enc` sans risque. Rien n'est chiffré tant que ces étapes n'ont pas
  été faites (une fois par développeur) :

  ```bash
  # 1. Installer sops et age (ex. apt/brew install sops age), puis générer
  #    sa clé perso — le fichier généré ne doit jamais être commité.
  age-keygen -o ~/.config/sops/age/keys.txt

  # 2. Remplacer le placeholder dans .sops.yaml par la clé PUBLIQUE affichée
  #    ("# public key: age1...").

  # 3. Chiffrer .env → .env.enc (committable, voir .gitignore) :
  npm run secrets:encrypt

  # 4. Sur une autre machine (avec la même clé privée en place) :
  npm run secrets:decrypt
  ```

- **Production/Preview (Vercel)** : "Environment Variables" du dashboard
  Vercel (Project → Settings → Environment Variables). Chiffrées au repos
  côté Vercel, jamais visibles en clair dans les logs de build, scindées par
  environnement (Production / Preview / Development) — une variable peut
  avoir une valeur différente selon l'environnement (ex. `STRIPE_SECRET_KEY`
  test en Preview, live en Production). **Un changement de valeur nécessite
  un redéploiement** pour être pris en compte (les variables sont injectées
  au build/à l'exécution des fonctions serverless, pas lues dynamiquement).
- **CI (GitHub Actions)** : le job `lint-and-check` utilise des valeurs
  factices en dur dans `ci.yml` (aucun vrai secret nécessaire, juste de quoi
  satisfaire la résolution de types `$env/static/*`). Le job `e2e` fait de
  même contre une base Postgres éphémère locale au run — aucun secret de
  dépôt (`Settings → Secrets and variables → Actions`) n'est utilisé
  aujourd'hui dans ce projet.

**Recommandation si l'équipe grandit** : au-delà d'un solo/duo occasionnel,
les "Environment Variables" Vercel deviennent limitantes (pas d'historique
d'accès par personne, pas de rotation programmée, partage de secrets hors
Vercel — ex. accès direct à la base Neon ou au dashboard Stripe — toujours
géré à la main). Un gestionnaire de secrets dédié apporte audit
trail/permissions granulaires :

- **Doppler** ou **1Password Secrets Automation** : SaaS, intégration
  simple avec Vercel (sync automatique) et GitHub Actions (action officielle),
  coût faible, bon rapport effort/bénéfice pour une petite équipe.
- **HashiCorp Vault** : self-hosted, plus complet (rotation dynamique,
  policies fines) mais overkill tant que l'infra reste sur Vercel/Neon
  managés — à réserver à une équipe avec déjà de l'infra à opérer soi-même.

Le signal à surveiller n'est pas un nombre de secrets, mais : plusieurs
contributeurs ayant besoin d'un sous-ensemble différent de secrets, ou un
premier départ d'équipe nécessitant de révoquer un accès sans redéployer.

## Rotation

Deux familles bien distinctes, avec des procédures différentes :

1. **Secrets à rotation « zéro coupure » supportée par le code** : deux clés
   valides simultanément le temps de la transition. C'est le cas
   d'`ENCRYPTION_KEY` (2FA) et des clés de signature QStash.
2. **Secrets à clé unique côté fournisseur** (Stripe, Sendcloud, Cloudinary,
   SMTP, Google OAuth, Upstash, Neon) : pas de double-lecture côté code, mais
   la plupart des fournisseurs permettent de garder l'ancienne clé active
   pendant qu'on active la nouvelle, puis de la révoquer une fois le nouveau
   déploiement confirmé sain.

Principe commun à toutes les rotations : **ne jamais révoquer l'ancien secret
avant d'avoir confirmé que le déploiement avec le nouveau fonctionne** (santé
de l'app, `/admin/metrics`, pas de pic de `http.5xx`, voir
[docs/admin/README.md](./admin/README.md#alerting)).

## `ENCRYPTION_KEY` (secrets 2FA : TOTP, codes de secours)

Mécanisme déjà en place (`src/lib/lucia/encryption.ts`, `User.encryptionVersion`) :
un secret 2FA est chiffré avec la clé et l'algorithme correspondant à sa
version (`1` = AES-128-GCM / `ENCRYPTION_KEY_LEGACY`, `2` = AES-256-GCM /
`ENCRYPTION_KEY`, version par défaut pour tout chiffrement neuf). Chaque
authentification 2FA réussie qui déchiffre un secret encore en version `1`
le ré-encode en version `2` à la volée — pas de migration en masse à lancer.

Cela couvre **une** rotation déjà effectuée (l'ancienne clé AES-128 devient la
clé legacy). Pour vérifier où en est la migration et savoir quand
`ENCRYPTION_KEY_LEGACY` peut être retirée de l'environnement :

```bash
npm run check:legacy-encryption
```

**Limite à connaître** : le schéma actuel gère exactement deux versions
(`1`/`2`), chacune pinnée à un algorithme précis. Il ne permet donc pas de
faire une _nouvelle_ rotation d'`ENCRYPTION_KEY` (ex. remplacer la clé
AES-256 actuelle par une autre clé AES-256) sans extension de code : il
faudrait ajouter une version `3` suivant exactement le même patron (nouvelle
clé + nouvel algorithme ou nouveau nom de variable, ancienne clé `2` devenant
lisible comme « legacy suivante »). Tant que ce n'est pas fait, la seule façon
de changer `ENCRYPTION_KEY` sans code neuf est disruptive : invalider tous les
secrets 2FA existants et forcer une reconfiguration (perte du confort
utilisateur, à réserver à une compromission avérée de la clé).

## Clés Sendcloud (`SENDCLOUD_PUBLIC_KEY` / `SENDCLOUD_SECRET_KEY`)

Pas de double-lecture côté code (`$lib/server/sendcloud/`) : une seule paire
de clés active à la fois.

1. Générer une nouvelle paire de clés dans le panel Sendcloud (Settings → API
   access) **sans révoquer l'ancienne**.
2. Mettre à jour `SENDCLOUD_PUBLIC_KEY`/`SENDCLOUD_SECRET_KEY` sur l'environnement
   de déploiement (Vercel), redéployer.
3. Vérifier une commande de bout en bout (création d'étiquette Sendcloud) et
   surveiller `/admin/metrics` (compteurs liés au disjoncteur, voir
   [docs/commerce/README.md](./commerce/README.md#résilience-sendcloud-disjoncteur--dead-letter)) —
   aucune ouverture de circuit breaker après le déploiement.
4. Révoquer l'ancienne paire de clés dans le panel Sendcloud une fois le point
   3 confirmé.

## `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`

Stripe garde l'ancienne clé secrète active jusqu'à révocation explicite, ce
qui permet une bascule sans coupure :

1. Dashboard Stripe → Developers → API keys → « Roll key » sur la clé secrète
   (génère une nouvelle clé, l'ancienne reste valide pendant la transition).
2. Mettre à jour `STRIPE_SECRET_KEY` sur l'environnement de déploiement,
   redéployer, vérifier un paiement de test.
3. Révoquer explicitement l'ancienne clé dans le dashboard une fois le
   déploiement confirmé (Stripe ne le fait jamais automatiquement).

Pour `STRIPE_WEBHOOK_SECRET` : Stripe permet d'avoir plusieurs endpoints de
webhook actifs simultanément. Créer un second endpoint pointant vers la même
URL (`/api/webhooks`) avec un nouveau secret, déployer
`STRIPE_WEBHOOK_SECRET` mis à jour, vérifier la réception d'évènements, puis
supprimer l'ancien endpoint dans le dashboard.

## Clés de signature QStash (déjà en rotation « zéro coupure »)

`getQStashReceiver()` (`src/lib/server/qstash.ts`) accepte simultanément
`QSTASH_CURRENT_SIGNING_KEY` et `QSTASH_NEXT_SIGNING_KEY` — c'est le mécanisme
de rotation natif d'Upstash QStash, déjà en place, rien à construire :

1. Dashboard Upstash QStash → « Rotate signing key » (l'ancienne clé courante
   devient automatiquement la clé `next`, une nouvelle clé courante est émise).
2. Mettre à jour les deux variables d'environnement en conséquence, redéployer.
3. Après la fenêtre de grâce Upstash, une seconde rotation retire l'ancienne
   clé de `next`.

## Autres secrets (même schéma générique : clé unique côté fournisseur)

`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET`, `SMTP_USER`/`SMTP_PASS`,
`GOOGLE_CLIENT_SECRET`, `UPSTASH_REDIS_REST_TOKEN`, mot de passe `DATABASE_URL`
(Neon) : même procédure générique que Sendcloud — générer le nouveau secret
côté fournisseur sans révoquer l'ancien (quand le fournisseur le permet),
basculer l'environnement de déploiement, vérifier, puis révoquer l'ancien.
Pour Neon spécifiquement, régénérer le mot de passe change `DATABASE_URL` et
`DIRECT_URL` en même temps (même utilisateur Postgres) — un seul redéploiement
couvre les deux.
