# Commerce (panier, checkout, ventes)

Tunnel de commande : panier serveur (`Order` PENDING), checkout, webhook Stripe
(`Transaction`, commande `PAID`), surface admin `/admin/sales`. Réservé en
écriture au visiteur connecté ; `/admin/sales` au rôle `ADMIN`.

Il est conçu pour être retirable d'un bloc. La procédure complète est dans
[retrait.md](./retrait.md) ; ce document décrit son fonctionnement. Objectifs
de latence/erreur et scripts de charge : [slo.md](./slo.md).

## Frontière du module

| Emplacement                                                                                   | Contenu                                                                                           |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --- | ------------------------- | -------------------------------------------- |
| `src/lib/commerce/`                                                                           | gardes panier / checkout, session Stripe (`checkout.ts`), chemins, panier invité (`guestCart.ts`) |
| `src/lib/prisma/order/` et `src/lib/prisma/transaction/`                                      | DAO Prisma                                                                                        |
| `src/lib/store/Data/cartStore.ts` + `cartSync.ts`                                             | panier client                                                                                     |
| `src/routes/api/save-cart/`                                                                   | persistance panier                                                                                |
| `src/routes/checkout/`                                                                        | tunnel + succès                                                                                   |
| `src/routes/api/webhooks/`                                                                    | Stripe `checkout.session.completed`                                                               |
| `src/lib/server/jobs/post-payment.ts`                                                         | facture + Sendcloud, hors du webhook (voir plus bas)                                              |
| `src/routes/api/jobs/post-payment/`                                                           | endpoint appelé par la queue (QStash)                                                             |
| `src/routes/admin/sales/`                                                                     | liste, facture, bordereau (double marqueur ADMIN)                                                 |     | `src/lib/prisma/returns/` | DAO des demandes de retour (`ReturnRequest`) |
| `src/routes/auth/settings/returns/`                                                           | demande de retour côté compte                                                                     |
| `src/routes/admin/returns/`                                                                   | approbation/refus + remboursement Stripe ou crédit compte (double marqueur ADMIN)                 |
| `src/lib/prisma/savedPayments/`, `src/lib/server/stripeCustomer.ts`                           | moyens de paiement enregistrés (DAO + création paresseuse du `Customer` Stripe)                   |
| `src/routes/auth/settings/saved-payments/`                                                    | ajout/suppression/défaut côté compte (Stripe Elements)                                            |
| `src/lib/prisma/giftCards/`                                                                   | DAO cartes cadeaux (solde décroissant)                                                            |
| `src/routes/admin/gift-cards/`, `src/routes/api/gift-cards/validate/`                         | émission/gestion admin, validation côté checkout                                                  |
| `src/lib/sendcloud/returnLabel.ts`                                                            | étiquette de retour Sendcloud (best-effort, posée à l'approbation)                                |
| `src/lib/prisma/transaction/getTransactionByInvoiceAndEmail.ts`, `src/routes/suivi-commande/` | suivi de commande sans compte (n° facture + email)                                                |
| `src/lib/server/jobs/cartRecovery.ts`, `src/routes/api/jobs/cart-recovery/`                   | relance panier abandonné (scan périodique, voir plus bas)                                         |

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
- Prix des lignes = `Product.price` (ou `ProductVariant.price` si une
  variante est sélectionnée — voir [docs/products](../products/README.md#variantes-produit)),
  jamais le JSON client ni le panier invité.
- Invité : `localStorage` seulement ; fusion au compte à signup / login
  (même `productId` **et** même `variantId` → quantités additionnées,
  plafonnées au stock de la ligne ; deux variantes du même produit ne
  fusionnent jamais entre elles).
- `?/checkout` : même propriétaire ; un `shippingCost` Sendcloud entre 0 et
  200 € est accepté pour créer la session Stripe. Un code promo et une carte
  cadeau (`giftCardCode`) se cumulent : la carte s'applique sur ce qu'il
  reste à payer une fois la remise promo déduite (voir « Cartes cadeaux »
  plus bas).
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

### Suivi de commande côté client

`/auth/settings/factures/[id]` affiche, au-dessus de la facture, un panneau
« Suivi de commande » (`$lib/components/invoice/OrderTrackingPanel.svelte`) —
statut de paiement (`formatOrderStatus`), méthode d'expédition, et numéro +
lien de suivi transporteur dès que `createSendcloudLabel` les a posés sur la
`Transaction` (`trackingNumber`/`trackingUrl`, voir résilience Sendcloud
ci-dessus). Pas de nouvel appel Sendcloud : lecture seule des champs déjà
écrits par le job post-paiement. Tant que l'étiquette n'est pas encore créée,
le panneau l'indique plutôt que de laisser un vide.

### Suivi de commande sans compte

`/suivi-commande` réutilise le même `OrderTrackingPanel` pour un visiteur
sans session : formulaire numéro de facture + email, résolu par
`getTransactionByInvoiceAndEmail` (comparaison email insensible à la casse).
Un couple invalide renvoie un message générique unique (« Aucune commande ne
correspond à ces informations. ») sans préciser lequel des deux champs est en
cause — sinon le formulaire devient un oracle pour tester des numéros de
facture au hasard. Limité par IP (`guestTrackingLimiter`,
`RefillingTokenBucket` de 8 jetons/30 s, `$lib/server/rate-limit.ts`) pour la
même raison : sans compte ni mot de passe à deviner, seul ce débit protège
contre l'énumération. Lien affiché sur `/checkout/success`.

### Webhook Sendcloud entrant (statut transporteur)

`POST /api/webhooks/sendcloud` (`src/routes/api/webhooks/sendcloud/+server.ts`)
reçoit les évènements `parcel_status_changed` de Sendcloud — le pendant
entrant du flux ci-dessus, qui ne fait que créer commande + étiquette.
Signature HMAC-SHA256 vérifiée sur le corps brut (header
`Sendcloud-Signature`, secret `SENDCLOUD_WEBHOOK_SECRET`, à renseigner dans
les réglages de l'intégration Sendcloud) via
`$lib/sendcloud/webhookSignature.ts` ; une signature absente ou invalide
renvoie 401. Les autres actions (`integration_connected`, `return_created`,
…) sont acquittées (200) sans traitement.

La transaction concernée est retrouvée par `sendcloudParcelId` (posé par
`createSendcloudLabel`, jamais par parsing de `order_number`). Le statut brut
Sendcloud (`parcel.status.id`/`.message`) est stocké tel quel
(`shippingStatusCode`/`shippingStatusMessage`/`shippingStatusUpdatedAt`) et
affiché verbatim par `OrderTrackingPanel` — volontairement jamais interprété
côté code, faute de mapping numérique fiable et documenté par Sendcloud.
Seul effet applicatif : la commande passe de `PAID` à `SHIPPED` au premier
webhook reçu (jamais de rétrogradation), `OrderStatus` n'ayant pas de
granularité plus fine. Toujours répondu 200 une fois la signature validée,
même si la transaction est introuvable : un code d'erreur ferait retenter
Sendcloud (jusqu'à 10 fois) un évènement de toute façon non actionnable.

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

## Retours / SAV

Module activable depuis `/admin/settings` (`StoreSettings.returnsEnabled`, voir
[docs/admin](../admin/README.md#modules-e-commerce-optionnels---adminsettings)).
Une commande payée (`Transaction`) peut faire l'objet d'une seule demande de
retour (`ReturnRequest`, `transactionId` unique) : le compte la crée depuis
`/auth/settings/returns` (liste ses factures) puis
`/auth/settings/returns/[transactionId]` (motif libre). Ces deux routes
répondent 404 si le module est désactivé, comme les autres modules optionnels.

Côté admin, `/admin/returns` liste les demandes (page dédiée, pas le
composant `Table.svelte` générique — son dialogue de confirmation est câblé
pour une suppression, pas pour approuver/refuser) :

- **Refuser** : passe `status` à `REJECTED`, aucun appel Stripe.
- **Approuver + rembourser** : émet un remboursement Stripe **intégral et
  immédiat**. `Transaction.stripePaymentId` est l'id de la Checkout Session
  (pas du PaymentIntent) : il faut d'abord la relire
  (`stripe.checkout.sessions.retrieve(id, { expand: ['payment_intent'] })`)
  pour obtenir le PaymentIntent avant `stripe.refunds.create`. Le statut passe
  à `REFUNDED` et `stripeRefundId` est conservé.
- **Créditer le compte** (`?/creditStore`, alternative au remboursement) :
  n'appelle jamais Stripe — évite les frais de transaction sur un retour et
  incite au rachat. Émet une `GiftCard` (`createGiftCard`, même génération de
  code que l'admin cartes cadeaux) pour le montant intégral de la
  transaction, associée au compte par `recipientEmail`, puis envoie le code
  par e-mail. Le statut passe à `CREDITED` et `ReturnRequest.giftCardId`
  conserve l'id de la carte émise (pas de relation formelle, même découplage
  que `stripeRefundId`/`PromoCode` ailleurs dans le schéma). N'apparaît que
  si `StoreSettings.giftCardsEnabled` est actif — ce chemin s'appuie
  entièrement sur le module cartes cadeaux, il n'a pas son propre
  interrupteur.

Pas de remboursement partiel, pas de ré-expédition/échange : uniquement un
remboursement complet (Stripe ou crédit compte) vers le moyen choisi par
l'admin.

### Étiquette de retour Sendcloud

À l'approbation — Stripe ou crédit compte, les deux traitements appellent la
même fonction — `createSendcloudReturnLabel`
(`src/lib/sendcloud/returnLabel.ts`) génère une étiquette retour (`is_return:
true`, destination = l'adresse de la boutique plutôt que celle du client —
inverse de l'étiquette d'envoi) et pose `returnTrackingNumber`/
`returnTrackingUrl` sur le `ReturnRequest`. Appel **best-effort** : encadré
dans un `try/catch` séparé de l'appel Stripe, un échec Sendcloud ne bloque
jamais le remboursement déjà effectué — seulement une entrée `WARN` dans les
logs. Le compte voit le numéro de suivi sur
`/auth/settings/returns/[transactionId]` dès qu'il est posé, avec un message
d'attente sinon.

⚠️ Le champ `is_return` n'a pas été vérifié contre un compte Sendcloud réel
dans l'environnement de développement de ce projet (pas de sandbox
disponible) : à valider une fois avant la première utilisation en
production.

## Cartes cadeaux

Module activable depuis `/admin/settings` (`StoreSettings.giftCardsEnabled`,
voir [docs/admin](../admin/README.md#modules-e-commerce-optionnels---adminsettings)).
Solde décroissant (`GiftCard`, `src/lib/prisma/giftCards/giftCards.ts`),
émis uniquement depuis l'admin (`/admin/gift-cards/create` — code généré,
format `GIFT-XXXX-XXXX-XXXX`, jamais choisi par l'admin ni le client) : pas
de vente en ligne de carte cadeau, seulement leur utilisation au checkout.

Un code se cumule avec un éventuel code promo (`PromoCodeInput`,
[docs/promo](../promo/README.md)) : au checkout, le serveur calcule d'abord
la remise promo, puis plafonne le montant de la carte cadeau par ce qu'il
reste à payer (`validateGiftCard(code, productTotalTTC - promoDiscount)`) —
jamais l'un sans l'autre, jamais un montant envoyé par le client. Le solde
est décrémenté **au même moment que `PromoCode.usageCount`** : à la création
de la session Stripe, pas à la confirmation du paiement — une session Stripe
abandonnée consomme donc le solde de la carte, exactement comme un code
promo abandonné consomme son compteur d'usage. Décision assumée pour rester
cohérent avec le comportement déjà en place plutôt que d'introduire un
second modèle de décompte au moment du webhook.

Édition admin (`/admin/gift-cards/[id]`) : statut, destinataire, note,
expiration. La valeur d'émission et le solde ne se modifient jamais par ce
formulaire — un ajustement de solde (SAV, remboursement partiel) passe par un
formulaire séparé et explicite, pour ne jamais mélanger metadata et argent
dans le même geste.

## Moyens de paiement enregistrés

Module activable depuis `/admin/settings` (`StoreSettings.savedPaymentsEnabled`).
Un compte peut enregistrer plusieurs cartes (`SavedPaymentMethod`) depuis
`/auth/settings/saved-payments`, via Stripe Elements + un `SetupIntent`
(`POST /auth/settings/saved-payments/setup-intent`) — jamais de numéro de
carte qui transite par le serveur applicatif, uniquement l'id de
`PaymentMethod` renvoyé par Stripe après confirmation côté client.

`User.stripeCustomerId` est créé **paresseusement** (`ensureStripeCustomer`,
`$lib/server/stripeCustomer.ts`) : à l'ajout de la première carte, jamais au
signup ni au premier passage en caisse. Au checkout suivant, si le compte a
déjà un `stripeCustomerId`, il est passé à `stripe.checkout.sessions.create`
(`customer`) pour que Stripe propose les cartes déjà enregistrées — sans
changement pour un compte qui n'en a aucune.

Supprimer une carte détache le `PaymentMethod` côté Stripe (best-effort : un
`PaymentMethod` déjà détaché ailleurs ne bloque pas la suppression locale) et
efface la ligne locale. Une seule carte par défaut à la fois.

## Relance panier abandonné

Module activable depuis `/admin/settings` (`StoreSettings.cartRecoveryEnabled`).
Contrairement aux autres modules de cette page, ce n'est pas une route ou un
champ qui apparaît/disparaît : c'est un scan périodique
(`$lib/server/jobs/cartRecovery.ts`, `runCartRecoveryJob`) qui détecte les
`Order` `PENDING` non finalisées et envoie un e-mail de relance avec un code
promo à usage unique, généré via le moteur de codes promo existant
(`createPromoCode`-like, `type: PERCENTAGE`, `usageLimit: 1`, expire après 7
jours).

Deux paliers indépendants, chacun avec son propre horodatage d'envoi
(`Order.cartReminder1SentAt`/`cartReminder2SentAt`) pour ne jamais relancer
deux fois le même palier sur la même commande : le filtre porte sur
`updatedAt`, pas `createdAt`, comme la purge des paniers abandonnés
(`cleanup.ts`) — un panier alimenté récemment n'est jamais relancé même s'il
est ancien.

| Palier | Délai depuis le dernier changement | Remise |
| ------ | ---------------------------------- | ------ |
| 1      | 1h                                 | 10 %   |
| 2      | 24h                                | 15 %   |

Les deux paliers restent largement dans la fenêtre des 30 jours avant purge
définitive de la commande (`ABANDONED_ORDER_DAYS`, `cleanup.ts`) : la relance
ne court jamais après une commande déjà supprimée.

Ce scan est **déclenché**, pas événementiel : contrairement à la fidélité ou
la facture (enfilées depuis le webhook Stripe), personne n'appelle ce job
après une action utilisateur. Il est planifié comme la purge
(`$lib/server/jobs/cleanup.ts`) : QStash Schedule
(`scripts/register-cart-recovery-schedule.mjs`, toutes les 30 minutes) ou
repli Vercel Cron (`vercel.json` → `/api/jobs/cart-recovery`), même route
double-auth (signature QStash ou `Authorization: Bearer $CRON_SECRET`) que
`/api/jobs/cleanup`. `StoreSettings.cartRecoveryEnabled` est vérifié dans le
job lui-même (pas par un appelant) : rien d'autre ne garde ce flag en amont.

Le lien de reprise pointe vers `/checkout` : le panier `PENDING` du compte
est déjà réattaché automatiquement à chaque requête
(`findPendingOrder`/`pendingOrderHandle`, voir plus haut), pas besoin d'un
token ou d'un lien spécial.

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

### Retours / SAV — `e2e/commerce/returns.spec.ts`

Le remboursement Stripe réel (`?/approve`) n'est pas rejouable : les
transactions viennent de `simulatePaidOrder`, sans vraie Checkout Session.
On vérifie que l'échec est géré proprement (`fail(500)`), pas le remboursement.
Le crédit compte (`?/creditStore`), lui, n'appelle jamais Stripe : entièrement
rejouable, y compris l'e-mail avec le code de la carte cadeau émise.

| #   | Étape                                                    | Geste                                       | Preuve                                                   |
| --- | -------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------- |
| 1   | Module désactivé : routes compte fermées                 | GET `/auth/settings/returns[...]`           | 404                                                      |
| 2   | Demande de retour envoyée                                | formulaire motif → Envoyer                  | `ReturnRequest` `REQUESTED`                              |
| 3   | Une seconde demande n'est pas proposée                   | revisite de la page                         | formulaire absent, statut affiché                        |
| 4   | Admin : la demande est visible et refusable              | `/admin/returns` → Refuser → Confirmer      | statut `REJECTED`                                        |
| 5   | Admin : crédit compte au lieu du remboursement           | Créditer le compte → Confirmer              | statut `CREDITED`, `GiftCard` émise, e-mail avec le code |
| 6   | Crédit indisponible si cartes cadeaux désactivées        | bouton absent, `giftCardsEnabled` à `false` | statut inchangé `REQUESTED`                              |
| 7   | Admin : l'approbation échoue proprement sans Stripe réel | Approuver + rembourser → Confirmer          | message d'échec, statut inchangé                         |

Test à part : IDOR — un compte ne peut pas ouvrir la demande d'un autre (404).
Le blocage anonyme/CLIENT de `/admin/returns` est couvert par `ADMIN_PATHS`.

### Moyens de paiement enregistrés — `e2e/commerce/saved-payments.spec.ts`

L'ajout de carte (`?/attach`) passe par un `SetupIntent` Stripe réel : non
rejouable en e2e. Les cartes sont insérées directement en base
(`createSavedPaymentMethod`), comme si `attach` avait déjà réussi.

| #   | Étape                                          | Geste                               | Preuve                              |
| --- | ---------------------------------------------- | ----------------------------------- | ----------------------------------- |
| 1   | Module désactivé : route et SetupIntent fermés | GET / POST                          | 404 / 404                           |
| 2   | Liste : les deux cartes sont affichées         | GET `/auth/settings/saved-payments` | marque + 4 derniers chiffres        |
| 3   | Changement de carte par défaut                 | bouton étoile                       | `isDefault` bascule en base         |
| 4   | Suppression                                    | bouton corbeille                    | carte absente de l'UI et de la base |

Test à part : IDOR — un compte ne peut pas supprimer la carte d'un autre.

### Cartes cadeaux — `e2e/gift-cards/validate.spec.ts`, `e2e/gift-cards/admin.spec.ts`

Stripe n'est pas appelé : `decrementGiftCardBalance` suit
`stripe.checkout.sessions.create`, hors de portée de ces specs (même
convention que `incrementUsage` pour les codes promo).

| #   | Étape                                                         | Geste                             | Preuve                                               |
| --- | ------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------- |
| 1   | API : acceptée / inconnue / inactive / expirée / épuisée      | POST `/api/gift-cards/validate`   | `valid`/`reason` par cas                             |
| 2   | Montant plafonné par le reste à payer, pas seulement le solde | `maxApplicable` < solde           | `amount === maxApplicable`                           |
| 3   | Désactivée globalement : refusée même avec un code valide     | flag `giftCardsEnabled` à `false` | 404                                                  |
| 4   | Checkout : carte appliquée seule puis cumulée à un code promo | formulaires « Appliquer »         | montant affiché ; carte retirée si le plafond change |

Administration (`admin.spec.ts`) : liste, désactivation, ajustement manuel du
solde (ne touche jamais `initialValue`), suppression, création avec code
généré affiché une seule fois. À part : CLIENT POST `?/deleteGiftCard` — la
carte reste.

### Relance panier abandonné — `e2e/commerce/cart-recovery.spec.ts`

Le job est appelé directement via `POST /api/jobs/cart-recovery` (même
en-tête `CRON_SECRET` que Vercel Cron en repli sans QStash) : c'est un scan
périodique, pas une réaction à une action utilisateur, donc rien à rejouer
côté webhook. `Order.updatedAt` est reculé via une écriture SQL directe
(`backdateOrder`, `@updatedAt` n'est pas surchargeable via un simple
`update()` Prisma) pour simuler l'ancienneté du panier sans attendre.

| #   | Étape                                         | Geste                      | Preuve                                                    |
| --- | --------------------------------------------- | -------------------------- | --------------------------------------------------------- |
| 1   | Module désactivé : aucune relance même à 30h  | flag à `false` + job       | `cartReminder1/2SentAt` restent `null`, aucun e-mail      |
| 2   | Palier 1 (10 %) à 1h30                        | `backdateOrder(1.5)` + job | e-mail avec code `RELANCE-…`, `cartReminder1SentAt` posé  |
| 3   | Rejouer le job tout de suite : pas de doublon | job une seconde fois       | aucun nouvel e-mail                                       |
| 4   | Palier 2 (15 %) à 25h                         | `backdateOrder(25)` + job  | second e-mail, code différent, `cartReminder2SentAt` posé |

```bash
npm run test:e2e
```
