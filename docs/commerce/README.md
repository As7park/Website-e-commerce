# Commerce (panier, checkout, ventes)

Tunnel de commande : panier serveur (`Order` PENDING), checkout, webhook Stripe
(`Transaction`, commande `PAID`), surface admin `/admin/sales`. Réservé en
écriture au visiteur connecté ; `/admin/sales` au rôle `ADMIN`.

Il est conçu pour être retirable d'un bloc. La procédure complète est dans
[retrait.md](./retrait.md) ; ce document décrit son fonctionnement. Objectifs
de latence/erreur et scripts de charge : [slo.md](./slo.md).

## Frontière du module

| Emplacement                                              | Contenu                                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `src/lib/commerce/`                                      | gardes panier / checkout, session Stripe (`checkout.ts`), chemins, panier invité (`guestCart.ts`) |
| `src/lib/prisma/order/` et `src/lib/prisma/transaction/` | DAO Prisma                                                                                        |
| `src/lib/store/Data/cartStore.ts` + `cartSync.ts`        | panier client                                                                                     |
| `src/routes/api/save-cart/`                              | persistance panier                                                                                |
| `src/routes/checkout/`                                   | tunnel + succès                                                                                   |
| `src/routes/api/webhooks/`                               | Stripe `checkout.session.completed`                                                               |
| `src/lib/server/jobs/post-payment.ts`                    | facture + Sendcloud, hors du webhook (voir plus bas)                                              |
| `src/routes/api/jobs/post-payment/`                      | endpoint appelé par la queue (QStash)                                                             |
| `src/routes/admin/sales/`                                | liste, facture, bordereau (double marqueur ADMIN)                                                 |

Le point d'accroche est le hook `pendingOrderHandle` dans `src/hooks.server.ts`
(après `authHandle` / `adminHandle`). Sans lui, plus de commande PENDING par
visiteur connecté.

Sans compte, le panier est uniquement dans le navigateur (`localStorage`, clé
`commerce:guest-cart`, voir `src/lib/commerce/guestCart.ts`). À l'inscription ou
à la connexion, les lignes sont fusionnées dans l'`Order` du compte. Le checkout
reste derrière login.

Partout ailleurs, une dépendance au tunnel est signalée par `COMMERCE-PLUGIN` :

```bash
rg "COMMERCE-PLUGIN" src/ prisma/
```

## Ce qui n'est pas le commerce

| Module    | Marqueur         | Pourquoi                                                     |
| --------- | ---------------- | ------------------------------------------------------------ |
| Catalogue | `PRODUCT-PLUGIN` | fournit `Product` et le prix à revalider                     |
| Blog      | `BLOG-PLUGIN`    | articles Prisma, hors tunnel                                 |
| Auth      | `AUTH-PLUGIN`    | `locals.user`, adresses, factures compte                     |
| Admin     | `ADMIN-PLUGIN`   | gardes de `/admin/sales`                                     |
| Promo     | `PROMO-PLUGIN`   | champ checkout ; tests dans [docs/promo](../promo/README.md) |
| Sendcloud | `SENDCLOUD`      | options / points relais / étiquettes                         |

Les projets sur-mesure (`Custom`, `no_shipping`) restent de la dette atelier.

## Contrat serveur

- `/api/save-cart` : authentifié, `order.userId` = visiteur, statut `PENDING`.
- Prix des lignes = `Product.price`, jamais le JSON client ni le panier invité.
- Invité : `localStorage` seulement ; fusion au compte à signup / login
  (même `productId` → quantités additionnées, plafonnées au stock).
- `?/checkout` : même propriétaire ; un `shippingCost` Sendcloud entre 0 et
  200 € est accepté pour créer la session Stripe.
- Webhook : sous verrou (`stripe:checkout:<session id>`, `src/lib/server/lock.ts`)
  pour tolérer une double livraison Stripe, crée la `Transaction` et passe
  l'`Order` en `PAID`. Facture et Sendcloud partent ensuite chacun dans leur
  propre job asynchrone (voir ci-dessous), pas dans la requête webhook. Un
  nouveau panier PENDING peut naître ensuite (c'est voulu).

## Jobs post-paiement (facture, Sendcloud)

Une fois la `Transaction` écrite, le webhook enfile `enqueueInvoiceEmailJob`
et `enqueuePostPaymentJob` (`src/lib/server/qstash.ts`) en parallèle, au lieu
d'appeler directement l'e-mail de facture et Sendcloud : un appel Sendcloud
lent ne doit jamais faire traîner la réponse au webhook Stripe, au risque
d'un timeout perçu côté Stripe (et donc d'une relivraison) — et un pic
d'envois SMTP (ses propres limites de débit) ne doit pas être couplé à la
disponibilité de Sendcloud, ni l'inverse : ce sont deux files indépendantes,
chacune avec son propre retry QStash.

- **QStash configuré** (`QSTASH_TOKEN` + une URL publique — `APP_URL`, ou à
  défaut `VERCEL_URL` fourni par Vercel) : chaque job est publié vers sa
  route (`/api/jobs/invoice-email`, `/api/jobs/post-payment`), dont la
  signature est vérifiée (`QSTASH_CURRENT_SIGNING_KEY` /
  `QSTASH_NEXT_SIGNING_KEY`) ; QStash gère les retries en cas d'échec.
- **QStash absent** (dev local, ou `.env.test`) : `runInvoiceEmailJob` et
  `runPostPaymentJob` s'exécutent directement, en synchrone, dans la requête
  webhook — mêmes effets, sans file d'attente.

`runInvoiceEmailJob` (`src/lib/server/jobs/invoice-email.ts`) tourne sous
verrou (`invoice-email:<transaction id>`). `runPostPaymentJob`
(`src/lib/server/jobs/post-payment.ts`) tourne sous verrou
(`post-payment:<transaction id>`) et ne rappelle jamais Sendcloud si
`sendcloudOrderCreatedAt` / `sendcloudParcelId` sont déjà posés : une
commande ou une étiquette Sendcloud a un coût réel, un retry ne doit jamais
en recréer une seconde.

### Résilience Sendcloud (disjoncteur + dead-letter)

Les appels `createSendcloudOrder`/`createSendcloudLabel` passent par
`withCircuitBreaker('sendcloud', …)` (`$lib/server/circuit-breaker.ts`) : au
5e échec en moins de 2 minutes, le disjoncteur s'ouvre et court-circuite les
appels Sendcloud pendant 60s (sans requête réseau), pour ne pas marteler un
fournisseur déjà en difficulté à chaque retry QStash.

En parallèle, `recordJobAttempt` (`$lib/server/job-attempts.ts`) compte les
échecs pour **cette transaction précise** (clé `sendcloud:<transaction id>`,
TTL 24h) : après 5 tentatives infructueuses, le job arrête de relancer
l'erreur (donc QStash arrête de retenter) et journalise en `ERROR` + Sentry
(`tags: { deadLetter: 'sendcloud' }`) pour investigation manuelle — la
transaction reste identifiable en base (`sendcloudOrderCreatedAt`/
`sendcloudParcelId` toujours absents) pour un retraitement ultérieur.

### Débit SMTP sous rafale (facture)

`runInvoiceEmailJob` (`$lib/server/jobs/invoice-email.ts`) consomme un jeton
d'un `RefillingTokenBucket` global (`smtp-send`, 5 en rafale, 1/s en
soutenu — donc environ 60 e-mails/min max) avant d'appeler `sendInvoiceEmail`.
Volontairement conservateur : à ajuster selon le plan SMTP souscrit (Brevo)
si un pic de commandes légitime le sature en usage normal.

Un rejet lève une exception plutôt que d'attendre : le job ne doit jamais
traîner, QStash retente déjà ce job précis avec son propre backoff
(`/api/jobs/invoice-email`), indépendamment du job Sendcloud. Chaque rejet
incrémente le compteur `smtp.throttled` (visible sur `/admin/metrics`) et,
au-delà de 30 rejets en 5 minutes, déclenche une alerte Sentry via
`reportIfRepeated` (voir [../admin/README.md](../admin/README.md#alerting)).

Côté webhook (`src/routes/api/webhooks/+server.ts`), l'enfilage des deux jobs
(facture + Sendcloud) utilise `Promise.allSettled`, pas `Promise.all` : la
transaction est déjà commitée en base à ce stade, un rejet (repli direct sans
QStash en dev, ou débit SMTP atteint) ne doit jamais faire échouer la réponse
200 au webhook Stripe — chaque job géré par QStash a de toute façon son
propre retry, découplé de la session Stripe d'origine.

## Tests

Les numéros sont ceux des `test.step`. Changer la procédure ici, puis le spec,
puis le code. Index : [../../e2e/README.md](../../e2e/README.md).

Stripe n'est **pas** appelé pour créer une session Checkout : le paiement
simulé en Prisma (`simulatePaidOrder`) reste pour le spec checkout. Le webhook
e2e est couvert à part : corps signé localement (`generateTestHeaderString`),
sans carte ni API Stripe.

En **dev** (`npm run dev`), `stripe listen` relaie les événements Stripe vers
`http://localhost:2000/api/webhooks`. Copier le `whsec_…` affiché par le CLI
dans `STRIPE_WEBHOOK_SECRET` du `.env`, puis relancer Vite. Une fois :
`stripe login`. Hors `npm run dev` : `npm run stripe:listen`.

### Panier — `e2e/commerce/cart.spec.ts`

| #   | Étape                                 | Geste                        | Preuve                          |
| --- | ------------------------------------- | ---------------------------- | ------------------------------- |
| 1   | Fiche : ajouter au panier             | bouton « Ajouter au panier » | UI panier + `OrderItem` en base |
| 2   | `/api/save-cart` d'une autre commande | POST id d'un autre user      | 403, ligne inchangée            |
| 3   | Prix posté ≠ catalogue                | POST `price: 0.01`           | persisté = `Product.price`      |

### Panier invité — `e2e/commerce/guest.spec.ts`

| #   | Étape                            | Geste                  | Preuve                                 |
| --- | -------------------------------- | ---------------------- | -------------------------------------- |
| 1   | Anonyme : ajouter puis recharger | bouton puis reload     | item encore visible                    |
| 2   | Anonyme puis inscription         | signup après add       | `OrderItem` en base, localStorage vide |
| 3   | Compte + invité (autre produit)  | login après add invité | les deux lignes en base                |

### Checkout — `e2e/commerce/checkout.spec.ts`

| #   | Étape                                 | Geste         | Preuve                             |
| --- | ------------------------------------- | ------------- | ---------------------------------- |
| 1   | Anonyme GET `/checkout`               | navigation    | `/auth/login`                      |
| 2   | CLIENT avec panier                    | `/checkout`   | sélecteur d'adresse                |
| 3   | POST sans adresse / sans être proprio | `?/checkout`  | 400 / 403                          |
| 4   | Paiement simulé                       | helper Prisma | l'order payée n'est plus `PENDING` |

### Webhook Stripe — `e2e/commerce/stripe.spec.ts`

| #   | Étape                        | Geste                                    | Preuve                         |
| --- | ---------------------------- | ---------------------------------------- | ------------------------------ |
| 1   | Signature invalide           | POST `/api/webhooks` HMAC faux           | 400, pas de `Transaction`      |
| 2   | `checkout.session.completed` | POST signé (`STRIPE_WEBHOOK_SECRET` e2e) | `Order` `PAID`, `Transaction`  |
| 3   | Facture compte               | GET `/auth/settings/factures/[id]`       | HTML contient l'id transaction |
| 4   | Facture admin                | GET `/admin/sales/facture/[id]`          | HTML contient l'id             |
| 5   | Bordereau admin              | GET `/admin/sales/bordereau/[id]`        | HTML contient l'id             |

Pas de paiement carte. Sendcloud n'est pas appelé (`PUBLIC_ENV=test`).
`incrementUsage` n'est pas joué : il suit `stripe.checkout.sessions.create`.
`.env.test` ne renseigne pas `QSTASH_TOKEN` : le job post-paiement (facture)
s'exécute directement dans la requête webhook, sans file d'attente.

### Ventes — `e2e/commerce/sales.spec.ts`

| #   | Étape                               | Geste                     | Preuve        |
| --- | ----------------------------------- | ------------------------- | ------------- |
| 1   | ADMIN voit la transaction           | `/admin/sales`, recherche | cellule email |
| 2   | CLIENT GET `/admin/sales`           | navigation                | `/`           |
| 3   | Facture user : uniquement la sienne | GET facture d'un autre    | 404           |

```bash
npm run test:e2e
```
