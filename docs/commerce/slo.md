# Objectifs de niveau de service (SLO)

Ce document fixe des cibles de latence/erreur pour les parcours identifiés
comme sensibles à la charge, et les fait correspondre aux seuils déjà encodés
dans les scripts k6 (`k6/*.js`, section `thresholds`) — ce ne sont pas deux
sources de vérité séparées : si un seuil change ici, il doit changer dans le
script correspondant, et inversement.

Portée volontairement limitée aux chemins déjà instrumentés (métriques
`/admin/metrics`, scripts k6) — pas un SLO d'entreprise couvrant tout le
site.

## Cibles par parcours

| Parcours         | Route(s)                                          | p95 latence | Taux d'erreur | Script k6       |
| ---------------- | ------------------------------------------------- | ----------- | ------------- | --------------- |
| Catalogue public | `/`, `/products`, `/products/[slug]`              | < 800 ms    | < 1 %         | `k6/catalog.js` |
| Connexion        | `/auth/login` (GET + `?/login`)                   | < 1000 ms   | < 1 %         | `k6/login.js`   |
| Listings admin   | `/admin/users`, `/admin/sales`, `/admin/products` | < 1500 ms   | < 1 %         | `k6/admin.js`   |
| Webhook Stripe   | `/api/webhooks` (`checkout.session.completed`)    | < 2000 ms   | < 1 %         | `k6/webhook.js` |

Le webhook a une cible plus large (2 s) que les autres : contrairement à une
requête de lecture, il fait une écriture Prisma transactionnelle (facture,
totaux, snapshot) puis enfile deux jobs (`enqueuePostPaymentJob`,
`enqueueInvoiceEmailJob`) avant de répondre — plus de travail intrinsèque par
requête, et Stripe tolère plusieurs secondes avant de considérer un webhook
en échec (il retente lui-même en cas de timeout/5xx).

## Ce qui n'a pas (encore) de cible chiffrée

- **Jobs asynchrones** (`job.post-payment`, `job.invoice-email`,
  `job.cleanup`) : leur durée est mesurée (`$lib/server/metrics.ts`,
  visible sur `/admin/metrics`), mais sans seuil d'alerte formel — ils
  tournent hors du chemin critique d'une requête utilisateur, un
  ralentissement n'est pas directement visible pour un visiteur. À
  surveiller manuellement ; un seuil viendra si un incident le justifie.
- **Rate-limit / anti-scraping** (`rate-limit.rejected.*`,
  `anti-scraping.*`) : ce sont des compteurs de protection, pas des
  indicateurs de performance — un taux élevé signale une attaque/un bug
  client, pas une régression de latence.
- **Disponibilité Sendcloud** : couverte par le disjoncteur
  (`$lib/server/circuit-breaker.ts`) et le dead-letter
  (`$lib/server/job-attempts.ts`, voir [docs/commerce/README.md](./README.md#résilience-sendcloud-disjoncteur--dead-letter)),
  pas par un SLO de latence — Sendcloud est un tiers, sa latence ne se
  pilote pas depuis ce projet.

## Comment vérifier

```bash
npm run seed:perf
npm run seed:webhook-fixtures   # pour k6/webhook.js uniquement

npm run load:catalog
npm run load:login
npm run load:admin
STRIPE_WEBHOOK_SECRET=whsec_... npm run load:webhook
```

Chaque script échoue (`exit code != 0`) si un seuil `thresholds` n'est pas
tenu — c'est ce qui rend ces cibles vérifiables plutôt que déclaratives.
Détail des scénarios et prérequis : [k6/README.md](../../k6/README.md).
