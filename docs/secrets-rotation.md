# Rotation des secrets

Ce document couvre la rotation des secrets applicatifs mentionnés dans la
roadmap : `ENCRYPTION_KEY`, `STRIPE_SECRET_KEY`, les clés Sendcloud, ainsi que
les autres secrets de l'application selon le même schéma. Deux familles bien
distinctes, avec des procédures différentes :

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
