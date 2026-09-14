# Scripts de charge k6

Quatre scénarios, ciblant les parcours identifiés comme sensibles à la charge
dans la feuille de route (catalogue public paginé, connexion, listings
admin, webhook Stripe) :

| Script       | Cible                                                       | Compte requis                                      |
| ------------ | ----------------------------------------------------------- | -------------------------------------------------- |
| `catalog.js` | `/`, `/products?page=N`, fiche produit                      | Aucun (public)                                     |
| `login.js`   | `/auth/login` (GET + POST `?/login`)                        | Comptes perf (`npm run seed:perf`)                 |
| `admin.js`   | `/admin/users`, `/admin/sales`, `/admin/products` (paginés) | Compte admin de démo (`npm run seed`)              |
| `webhook.js` | `/api/webhooks` (`checkout.session.completed`)              | Fixtures dédiées (`npm run seed:webhook-fixtures`) |

Le reste du tunnel de checkout (formulaire d'adresse, redirection vers la
page Stripe hébergée, retour `/checkout/success`) n'est volontairement pas
scripté : le simuler fidèlement demanderait une vraie session Checkout
Stripe (test mode), hors de portée d'un simple script HTTP k6 ; il reste
couvert par les specs e2e (`e2e/commerce/stripe.spec.ts`). `webhook.js`
isole en revanche précisément le chemin qui inquiète le plus sous charge :
l'écriture de la `Transaction` et l'enfilage des jobs Sendcloud/facture,
sans dépendre de Stripe — il signe lui-même un évènement minimal avec
`STRIPE_WEBHOOK_SECRET`, exactement comme le ferait `constructEvent` côté
serveur.

## Installation de k6

k6 n'est pas un paquet npm : binaire à part.

```bash
# Debian/Ubuntu
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6ACFD8
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# macOS
brew install k6

# Sans installation locale
docker run --rm -i --network host grafana/k6 run - < k6/catalog.js
```

## Préparer les données

```bash
npm run seed         # compte admin@madeindiamonds.com (démo)
npm run seed:perf     # 5000 produits, 3000 comptes perf-user-N@perf.test
npm run seed:webhook-fixtures   # Order PENDING dédiées à webhook.js (voir plus bas)
```

## Lancer un scénario

```bash
npm run load:catalog
npm run load:login
npm run load:admin
STRIPE_WEBHOOK_SECRET=whsec_... npm run load:webhook
```

Ou directement, avec surcharge des variables d'environnement :

```bash
BASE_URL=http://localhost:2000 PERF_USER_COUNT=3000 k6 run k6/login.js
```

Variables reconnues (`k6/lib/config.js`) : `BASE_URL` (défaut
`http://localhost:2000`), `PERF_USER_COUNT`, `PERF_PASSWORD`, `ADMIN_EMAIL`,
`ADMIN_PASSWORD`, `STRIPE_WEBHOOK_SECRET` (requis par `webhook.js` — doit être
le même secret que côté serveur, `.env` `STRIPE_WEBHOOK_SECRET`, en général
une clé `whsec_...` de test récupérée via `npm run stripe:listen`).

## `webhook.js` — détail

`prisma/seed-webhook-fixtures.js` crée, via Prisma, des `Order` PENDING
valides (adresse + un article) rattachées aux comptes `npm run seed:perf`,
et écrit `k6/webhook-fixtures.json` (ignoré par git). `webhook.js` lit ce
fichier, pioche une fixture, construit un évènement Stripe minimal
(`checkout.session.completed`, `metadata.order_id`), le signe avec
`STRIPE_WEBHOOK_SECRET` puis POST directement sur `/api/webhooks` — jamais
via une vraie session Stripe. Chaque appel utilise un `id` de session unique
(préfixe `perf_wh_`), donc réutilise la même `Order` plusieurs fois sans
conflit ; les transactions synthétiques créées sont nettoyées par
`npm run seed:perf:clean` (même préfixe `perf_` que les autres données perf).
Nettoyer les `Order` elles-mêmes : `npm run seed:webhook-fixtures:clean`.

## Objectifs de latence (SLO)

Les seuils `thresholds` de chaque script correspondent aux cibles documentées
dans [docs/commerce/slo.md](../docs/commerce/slo.md) — à mettre à jour aux
deux endroits si l'un change.

## Ne jamais lancer contre la production

Ces scénarios se connectent avec des mots de passe de démonstration en clair
(seeds de dev). Cibler uniquement un environnement local ou un staging
jetable, jamais un environnement contenant de vraies données ou de vrais
clients.

## Nettoyage

```bash
npm run seed:perf:clean
npm run seed:webhook-fixtures:clean
```
