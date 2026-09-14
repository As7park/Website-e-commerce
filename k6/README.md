# Scripts de charge k6

Trois scénarios, ciblant les parcours identifiés comme sensibles à la charge
dans la feuille de route (catalogue public paginé, connexion, listings
admin) :

| Script         | Cible                                                      | Compte requis                                  |
| -------------- | ----------------------------------------------------------- | ----------------------------------------------- |
| `catalog.js`   | `/`, `/products?page=N`, fiche produit                       | Aucun (public)                                  |
| `login.js`     | `/auth/login` (GET + POST `?/login`)                         | Comptes perf (`npm run seed:perf`)              |
| `admin.js`     | `/admin/users`, `/admin/sales`, `/admin/products` (paginés)  | Compte admin de démo (`npm run seed`)           |

Le webhook Stripe → job post-paiement n'est volontairement pas scripté ici :
le simuler fidèlement demanderait une vraie session Checkout Stripe (test
mode), hors de portée d'un simple script HTTP k6 ; il reste couvert par les
specs e2e (`e2e/commerce/stripe.spec.ts`).

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
```

## Lancer un scénario

```bash
npm run load:catalog
npm run load:login
npm run load:admin
```

Ou directement, avec surcharge des variables d'environnement :

```bash
BASE_URL=http://localhost:2000 PERF_USER_COUNT=3000 k6 run k6/login.js
```

Variables reconnues (`k6/lib/config.js`) : `BASE_URL` (défaut
`http://localhost:2000`), `PERF_USER_COUNT`, `PERF_PASSWORD`, `ADMIN_EMAIL`,
`ADMIN_PASSWORD`.

## Ne jamais lancer contre la production

Ces scénarios se connectent avec des mots de passe de démonstration en clair
(seeds de dev). Cibler uniquement un environnement local ou un staging
jetable, jamais un environnement contenant de vraies données ou de vrais
clients.

## Nettoyage

```bash
npm run seed:perf:clean
```
