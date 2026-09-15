# Catalogue produits

Vitrine publique et CRUD admin des produits Prisma : fiches, taxonomies, images
Cloudinary. Réservé en écriture au rôle `ADMIN` ; la lecture (`/products`) est
ouverte.

En plus des champs de base (nom, description, prix, stock, images,
taxonomies), `Product` porte deux attributs facultatifs, éditables depuis le
formulaire admin (`/admin/products/create`, `/admin/products/[id]`) : `sku`
(référence interne, unique, jamais utilisée comme clé de recherche) et
`compareAtPrice` (prix barré affiché à côté du prix réel — `price` reste le
seul montant facturé, aucune logique de remise n'en découle).

Il est conçu pour être retirable d'un bloc. La procédure complète est dans
[retrait.md](./retrait.md) ; ce document décrit son fonctionnement.

## Taxonomies

Un seul système générique (`Taxonomy`/`TaxonomyValue`/`ProductTaxonomyValue`),
géré en admin, jamais en champ texte libre — évite que « Or »/« or »/« OR »
cohabitent et cassent silencieusement un filtre. Chaque taxonomie (ex.
« Catégorie », « Matière ») définit son `slug` (paramètre d'URL du filtre
catalogue), son `type` (`TEXT`/`COLOR`/`NUMBER`/`BOOLEAN`/`DATE`) et si elle
accepte plusieurs valeurs par produit (`multiple`) :

| CRUD                 | Route                                                       |
| -------------------- | ----------------------------------------------------------- |
| Liste des taxonomies | table « Taxonomies » sur `/admin/products`                  |
| Créer une taxonomie  | `/admin/products/taxonomies/create`                         |
| Éditer une taxonomie | `/admin/products/taxonomies/[id]` (porte aussi ses valeurs) |
| Créer une valeur     | `/admin/products/taxonomies/[id]/values/create`             |
| Éditer une valeur    | `/admin/products/taxonomies/[id]/values/[valueId]`          |

Supprimer une `Taxonomy` supprime en cascade ses `TaxonomyValue` et les
liaisons `ProductTaxonomyValue` correspondantes (`onDelete: Cascade`) : un
produit perd simplement les valeurs de la taxonomie effacée, pas de table à
nettoyer manuellement.

Ce système remplace les anciennes taxonomies dédiées `Category`/`Material`
(tables `categories`/`materials` + `ProductCategory`/`Product.materialId`),
retirées par migration une fois tous les produits reportés sur des
`TaxonomyValue` équivalentes.

## Frontière du module

| Emplacement                                                                         | Contenu                                                         |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `src/lib/products/`                                                                 | lecture publique et chemins de tests                            |
| `src/lib/prisma/products/`, `src/lib/prisma/taxonomies/`, `src/lib/prisma/reviews/` | DAO Prisma                                                      |
| `src/routes/products/`                                                              | vitrine (fiche produit inclut les avis)                         |
| `src/routes/admin/products/`                                                        | CRUD back-office (produits, taxonomies — gardes = module admin) |

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

| Route              | Rôle                                                                 |
| ------------------ | -------------------------------------------------------------------- |
| `/products`        | liste avec sidebar de filtres, tous combinables et pilotés par l'URL |
| `/products/[slug]` | fiche ; 404 si le slug est inconnu                                   |

Les données viennent de Prisma. Contentful n'est plus utilisé pour les produits.

### Filtres du catalogue

Tous les filtres de `/products` sont des paramètres d'URL, combinables entre
eux, lus par `src/routes/products/+page.server.ts` et appliqués dans
`listProducts` (`src/lib/products/catalog.ts`) :

| Paramètre           | Filtre                                                                                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<slug-taxonomie>`  | une valeur de la taxonomie ; répétable si `multiple` (`?matiere=Or&matiere=Argent` — OR entre les valeurs), sélection unique sinon — le slug est dynamique (voir `Taxonomy.slug`) |
| `q`                 | recherche texte (`contains` Prisma, nom + description, insensible à la casse)                                                                                                     |
| `prixMin`/`prixMax` | bornes de prix                                                                                                                                                                    |
| `dispo=1`           | en stock uniquement (`stock > 0`)                                                                                                                                                 |
| `tri`               | `pertinence` (défaut) / `prix-asc` / `prix-desc` / `nouveaute`                                                                                                                    |
| `page`              | pagination                                                                                                                                                                        |

`getCatalogFacets` calcule, pour chaque taxonomie, les valeurs disponibles
(avec leur nombre de produits) et les bornes de prix pour la sidebar —
recalculées à partir de la recherche en cours et des filtres des **autres**
taxonomies, mais pas de la taxonomie elle-même : sinon cocher une valeur
ferait disparaître sa propre case. C'est la simplification courante des
vitrines de cette taille, pas un vrai faceted search par filtre croisé.

Chaque combinaison de paramètres fait partie de la clé de cache au même titre
que la page.

Les lectures publiques (`listProducts`, `getProductBySlug`,
`getCatalogFacets`, `getCachedTaxonomiesWithValues` dans
`src/lib/products/catalog.ts`) passent par un cache Redis de 60 s quand
Upstash est configuré (`src/lib/server/cache.ts`), invalidé automatiquement à
chaque écriture des DAO `src/lib/prisma/products` / `src/lib/prisma/taxonomies`
(un seul numéro de version pour tout le catalogue :
`bumpCacheVersion('catalog')`). Sans Redis configuré, ces fonctions relisent
Prisma à chaque appel, comme avant.

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
  produits partageant une catégorie legacy (`ProductCategory`, non retirée
  tant que la migration B n'est pas passée) avec la fiche consultée, le
  produit courant exclu. Affichées sous « Vous aimerez aussi » sur
  `/products/[slug]` uniquement quand le module est actif et qu'au moins un
  produit correspond.

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

`/admin/products` : liste, création, édition, suppression, taxonomies. Accès
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
| 1   | La liste affiche le nom Prisma | GET `/products`        | titres + libellé de la valeur de taxonomie |
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

### Taxonomies — `e2e/products/taxonomies.spec.ts`

| #   | Étape                                 | Geste                         | Preuve                                                  |
| --- | ------------------------------------- | ----------------------------- | ------------------------------------------------------- |
| 1   | Création de la taxonomie              | Save changes                  | ligne du tableau Taxonomies                             |
| 2   | Création d'une valeur                 | Save changes                  | ligne dans le tableau Valeurs de la taxonomie           |
| 3   | Association à un produit              | case cochée → Save changes    | `ProductTaxonomyValue` en base                          |
| 4   | Filtre catalogue par taxonomie        | GET `/products?<slug>=valeur` | produit présent ; valeur inconnue → absent              |
| 5   | Renommage de la valeur                | Save changes                  | valeur mise à jour                                      |
| 6   | Suppression de la taxonomie : cascade | dialogue Continue             | taxonomie et valeur absentes, produit sans cette valeur |

À part : CLIENT POST `?/createTaxonomy` — aucune taxonomie créée.

### Avis produit — `e2e/products/reviews.spec.ts`

| #   | Étape                             | Geste                     | Preuve                        |
| --- | --------------------------------- | ------------------------- | ----------------------------- |
| 1   | Anonyme invité à se connecter     | GET `/products/[slug]`    | pas de formulaire d'avis      |
| 2   | Note et commentaire publiés       | étoiles + commentaire     | `Review` en base, affiché     |
| 3   | Second avis du même compte refusé | POST `?/review` rejoué    | 409, `AlreadyReviewedError`   |
| 4   | Modération admin                  | `/admin/products/reviews` | avis absent après suppression |

À part : CLIENT POST `?/deleteReview` sur l'avis d'un autre — l'avis reste.

### Liste d'envies — `e2e/products/wishlist.spec.ts`

| #   | Étape                                 | Geste                         | Preuve                         |
| --- | ------------------------------------- | ----------------------------- | ------------------------------ |
| 1   | Module désactivé : tout fermé         | GET fiche/page/API            | bouton absent, 404, 404        |
| 2   | Ajout depuis la fiche produit         | clic cœur                     | `WishlistItem` créé            |
| 3   | Liste du compte                       | GET `/auth/settings/wishlist` | carte produit visible          |
| 4   | Retrait depuis la liste               | bouton Retirer                | ligne absente en base          |
| 5   | Ré-ajout puis retrait depuis la fiche | clic cœur × 2                 | libellé revient à « Ajouter… » |

À part : anonyme POST `/api/wishlist` — 401.

```bash
npm run test:e2e
```
