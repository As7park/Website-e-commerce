# Catalogue produits

Vitrine publique et CRUD admin des produits Prisma : fiches, catégories, images
Cloudinary. Réservé en écriture au rôle `ADMIN` ; la lecture (`/products`) est
ouverte.

En plus des champs de base (nom, description, prix, stock, images,
catégories), `Product` porte trois attributs facultatifs, éditables depuis le
formulaire admin (`/admin/products/create`, `/admin/products/[id]`) : `sku`
(référence interne, unique, jamais utilisée comme clé de recherche),
`material` (facette « Matière » du filtre catalogue) et `compareAtPrice`
(prix barré affiché à côté du prix réel — `price` reste le seul montant
facturé, aucune logique de remise n'en découle).

Il est conçu pour être retirable d'un bloc. La procédure complète est dans
[retrait.md](./retrait.md) ; ce document décrit son fonctionnement.

## Frontière du module

| Emplacement                                                | Contenu                                  |
| ---------------------------------------------------------- | ---------------------------------------- |
| `src/lib/products/`                                        | lecture publique et chemins de tests     |
| `src/lib/prisma/products/`, `src/lib/prisma/categories/`, `src/lib/prisma/reviews/` | DAO Prisma |
| `src/routes/products/`                                     | vitrine (fiche produit inclut les avis)  |
| `src/routes/admin/products/`                               | CRUD back-office (gardes = module admin) |

Le catalogue a un hook dédié dans `hooks.server.ts` : `catalogAntiScraping`,
qui ne s'applique qu'aux chemins `/products*` (rate-limit dédié + heuristique
`User-Agent`, voir plus bas). En dehors de cela, pas d'autre accroche : le
public est en lecture seule, les mutations passent déjà par `requireAdmin`.
Le point d'accroche, ce sont les routes `/products` et la section admin.

Partout ailleurs, une dépendance au catalogue est signalée par un marqueur
`PRODUCT-PLUGIN`. La liste exhaustive s'obtient ainsi :

```bash
rg "PRODUCT-PLUGIN" src/ prisma/
```

Le catalogue n'est **pas** le tunnel de commande. Panier, checkout, Stripe et
Sendcloud relèvent du module commerce : [docs/commerce](../commerce/README.md).
Le bouton « Ajouter au panier » sur la fiche est un accrochage COMMERCE.

## Vitrine

| Route              | Rôle                                                                   |
| ------------------ | ----------------------------------------------------------------------- |
| `/products`        | liste avec sidebar de filtres, tous combinables et pilotés par l'URL   |
| `/products/[slug]` | fiche ; 404 si le slug est inconnu                                     |

Les données viennent de Prisma. Contentful n'est plus utilisé pour les produits.

### Filtres du catalogue

Tous les filtres de `/products` sont des paramètres d'URL, combinables entre
eux, lus par `src/routes/products/+page.server.ts` et appliqués dans
`listProducts` (`src/lib/products/catalog.ts`) :

| Paramètre     | Filtre                                        |
| ------------- | ---------------------------------------------- |
| `categorie`   | catégorie (sélection unique)                   |
| `q`           | recherche texte (`contains` Prisma, nom + description, insensible à la casse) |
| `materiau`    | matière, répétable (`?materiau=Or&materiau=Argent`) — OR entre les valeurs |
| `prixMin`/`prixMax` | bornes de prix                           |
| `dispo=1`     | en stock uniquement (`stock > 0`)              |
| `tri`         | `pertinence` (défaut) / `prix-asc` / `prix-desc` / `nouveaute` |
| `page`        | pagination                                     |

`getCatalogFacets` calcule les matières disponibles (avec leur nombre de
produits) et les bornes de prix pour la sidebar — recalculées à partir de la
catégorie et de la recherche en cours, mais **pas** des filtres matière/prix/
disponibilité déjà posés : sinon cocher une matière ferait disparaître sa
propre case. C'est la simplification courante des vitrines de cette taille,
pas un vrai faceted search par filtre croisé.

Chaque combinaison de paramètres fait partie de la clé de cache au même titre
que la page.

Les trois lectures publiques (`listProducts`, `getProductBySlug`,
`listCategories` dans `src/lib/products/catalog.ts`) passent par un cache
Redis de 60 s quand Upstash est configuré (`src/lib/server/cache.ts`),
invalidé automatiquement à chaque écriture des DAO `src/lib/prisma/products` /
`src/lib/prisma/categories` (un seul numéro de version pour tout le
catalogue : `bumpCacheVersion('catalog')`). Sans Redis configuré, ces
fonctions relisent Prisma à chaque appel, comme avant.

### Avis produit

Un avis (`Review`, `src/lib/prisma/reviews/reviews.ts`) est réservé aux
comptes authentifiés, un seul par produit et par compte — contrainte unique
en base (`@@unique([productId, userId])`), pas seulement un formulaire masqué
côté client : une double soumission concurrente est rejetée proprement
(`AlreadyReviewedError`, code Prisma `P2002`) plutôt que de créer un doublon
ou de planter. La note moyenne (`getReviewSummary`) est une lecture directe,
non passée par le cache du catalogue ci-dessus — volume modeste, fraîcheur
after-submit plus utile ici qu'un TTL de 60 s. Supprimer un compte supprime
ses avis (`onDelete: Cascade`) : ce ne sont pas des écritures comptables à
conserver, contrairement aux `Transaction`.

### Liste d'envies & ventes croisées

Deux modules activables depuis `/admin/settings` (voir
[docs/admin](../admin/README.md#modules-e-commerce-optionnels---adminsettings)) :

- **Liste d'envies** (`WishlistItem`, `src/lib/prisma/wishlist/wishlist.ts`) —
  un produit par compte au plus une fois. Basculée depuis la fiche produit
  (`POST /api/wishlist`, authentifié) et consultée sur
  `/auth/settings/wishlist`. Les deux routes répondent 404/401 si le module
  est désactivé ou si le compte n'est pas connecté — jamais une page vide qui
  laisserait deviner que la route existe.
- **Ventes croisées** (`getRelatedProducts` dans `catalog.ts`) — jusqu'à 4
  produits partageant une catégorie avec la fiche consultée, le produit
  courant exclu. Affichées sous « Vous aimerez aussi » sur `/products/[slug]`
  uniquement quand le module est actif et qu'au moins un produit correspond.

### Anti-scraping

En plus du plafond global par IP (`global-ip`, `hooks.server.ts`), les chemins
`/products*` passent par un second bucket dédié et plus strict
(`catalog-ip`, 40 requêtes par IP avec un ajout de 1 toutes les 2 s —
voir `RefillingTokenBucket`), pensé pour qu'un visiteur qui feuillette des
fiches produit ne le remarque jamais, mais qu'un crawler qui aspire tout le
catalogue en boucle le déclenche vite. S'y ajoute un rejet heuristique des
`User-Agent` de clients HTTP scriptés (curl, wget, bibliothèques
Python/Go/Java, scrapers headless — `$lib/server/anti-scraping.ts`),
volontairement SANS bloquer les crawlers de moteurs de recherche connus
(casserait le référencement). Les deux rejets sont comptabilisés dans
`/admin/metrics` (`anti-scraping.rate-limited`, `anti-scraping.blocked-ua`).
Cette heuristique reste un filet applicatif simple, pas une garantie : un
`User-Agent` se falsifie trivialement.

### Images produits (CDN)

Les images uploadées via l'admin (`cloudinary.uploader.upload`) sont stockées
en base sous forme d'URL Cloudinary complète (`Product.images`), sans
transformation. `$lib/utils/cloudinaryUrl.ts` (`optimizedImageUrl(url,
width?)`) insère `f_auto,q_auto[,w_<width>]` dans l'URL au moment de
l'affichage — Cloudinary sert alors le format le plus compact supporté par le
navigateur (AVIF/WebP) et une largeur adaptée, sans ré-upload ni migration.
Appliqué partout où une image produit est rendue : catalogue (`/products`,
400px), fiche produit (`/products/[slug]`, 800px), panier et récapitulatif
checkout (100px), listing admin (80px). Fonction sans effet si l'URL n'est
pas une URL Cloudinary `/upload/` (donnée de seed/placeholder).

## Admin

`/admin/products` : liste, création, édition, suppression, catégories. Accès
couvert par `adminHandle`. Un produit déjà présent dans une `OrderItem` **ne
peut pas** être supprimé (`onDelete: Restrict`).

## Ce qui n'est pas le catalogue

L'authentification, le back-office dans son ensemble, le panier et le checkout.
Les `OrderItem` pointent vers `Product` : c'est un couplage commerce, pas une
raison de fusionner les deux modules.

## Tests

Les numéros sont ceux des `test.step`. Changer la procédure ici, puis le spec,
puis le code (`src/lib/products`, `/products`, `/admin/products`). Index :
[../../e2e/README.md](../../e2e/README.md).

### Vitrine — `e2e/products/catalog.spec.ts`

| #   | Étape                          | Geste                  | Preuve                                     |
| --- | ------------------------------ | ---------------------- | ------------------------------------------ |
| 1   | La liste affiche le nom Prisma | GET `/products`        | titres + lien catégorie                    |
| 2   | La fiche s’ouvre par slug      | GET `/products/[slug]` | nom, prix, ligne en base                   |
| 3   | Un slug inconnu renvoie 404    | GET slug absent        | statut 404                                 |
| 4   | Pas d’UI d’édition admin       | HTML de `/products`    | pas de `/admin/products` ni `passwordHash` |

### Admin — `e2e/products/admin.spec.ts`

Création UI Cloudinary **non** jouée (`.env.test` sans upload). Les produits
sont créés en Prisma (`createCatalogProduct`), le reste passe par l'UI.

| #   | Étape                                  | Geste                            | Preuve                          |
| --- | -------------------------------------- | -------------------------------- | ------------------------------- |
| 1   | Liste admin                            | GET `/admin/products`, recherche | ligne du tableau Produits       |
| 2   | Création Prisma visible sur la vitrine | GET `/products`                  | heading + base                  |
| 3   | Édition prix et stock                  | fiche → 9,99 / 7 → Save          | DB + « 9.99 € » / « Stock : 7 » |
| 4   | Suppression sans commande              | dialogue Continue                | produit absent en base          |
| 5   | Produit commandé : suppression refusée | même geste si `OrderItem`        | produit **encore** en base      |

À part : CLIENT POST `?/deleteProduct` — le produit reste.

```bash
npm run test:e2e
```
