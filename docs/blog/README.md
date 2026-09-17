# Blog

Vitrine publique et CRUD admin des articles Prisma : fiches, taxonomies
(catégorie, tags, et toute nouvelle facette créée en admin). Réservé en
écriture au rôle `ADMIN` ; la lecture (`/blog`) est ouverte et ne montre que
les articles `published`.

Il est conçu pour être retirable d'un bloc. La procédure complète est dans
[retrait.md](./retrait.md) ; ce document décrit son fonctionnement.

## Frontière du module

| Emplacement                | Contenu                                  |
| -------------------------- | ---------------------------------------- |
| `src/lib/blog/`            | lecture publique et chemins de tests     |
| `src/lib/prisma/blogPost/` | DAO Prisma (articles, taxonomies)        |
| `src/lib/schema/BlogPost/` | schémas Zod des formulaires admin        |
| `src/routes/blog/`         | vitrine                                  |
| `src/routes/admin/blog/`   | CRUD back-office (gardes = module admin) |

Contrairement à l'auth, le blog **n'a pas de hook** dans `hooks.server.ts` :
le public est en lecture seule, les mutations passent déjà par `requireAdmin`.
Le point d'accroche, ce sont les routes `/blog` et la section admin.

Partout ailleurs, une dépendance au blog est signalée par un marqueur
`BLOG-PLUGIN`. La liste exhaustive s'obtient ainsi :

```bash
rg "BLOG-PLUGIN" src/ prisma/
```

Les commentaires (`BlogComment`) sont un modèle Prisma rattaché aux articles
(`onDelete: Cascade`). Il n'y a pas d'UI publique de commentaires dans ce
module.

### Taxonomies (catégorie, tags...)

Le classement des articles utilise un système générique dédié au blog —
`BlogTaxonomy` (le type de facette, ex: « Catégorie », « Tag »),
`BlogTaxonomyValue` (ses valeurs possibles) et `BlogPostTaxonomyValue`
(l'assignation à un article). `BlogTaxonomy.multiple` distingue une sélection
unique (Catégorie) d'une sélection multiple (Tag). L'admin peut créer de
nouvelles facettes sans migration (`/admin/blog/taxonomies`).

Ce système est un mirroring volontaire de `$lib/prisma/taxonomies`
(produits) mais sur des tables séparées : le blog ne dépend pas des tables
PRODUCT-PLUGIN, ce qui garde les deux modules retirables indépendamment.

La vitrine publique (`src/lib/blog/catalog.ts`) suppose deux taxonomies au
slug fixe : `categorie` (nav de filtre) et `tag` (affichage libre sur la
fiche). Toute autre taxonomie créée en admin n'a pas d'UI publique dédiée.

Les anciens modèles `BlogCategory`/`BlogTag`/`BlogPostTag` et la colonne
`BlogPost.categoryId` restent en base (données migrées par la migration
`20260917270000_add_blog_taxonomies`) mais ne sont plus lus/écrits par
l'application — même convention que `materials`/`categories` côté produits.

## Vitrine

| Route          | Rôle                                                                      |
| -------------- | ------------------------------------------------------------------------- |
| `/blog`        | liste des articles publiés, paginée, filtrable et cherchable (ci-dessous) |
| `/blog/[slug]` | fiche ; 404 si le slug est inconnu **ou** si l'article n'est pas publié   |

Les données viennent de Prisma.

`/blog` accepte des paramètres d'URL combinables, tous optionnels :

| Paramètre     | Effet                                                                  |
| ------------- | ---------------------------------------------------------------------- |
| `?categorie=` | id d'une valeur de la taxonomie « Catégorie » (nav de pills)           |
| `?tag=`       | id d'une valeur de la taxonomie « Tag » (nav de badges cliquables)     |
| `?q=`         | recherche plein texte sur le titre (`contains`, insensible à la casse) |
| `?page=`      | pagination, `POSTS_PER_PAGE` (9) articles par page (`catalog.ts`)      |

Chaque filtre revient à la page 1 ; la pagination (liens Précédent/Suivant)
est le seul paramètre qui n'y ramène pas. Toute la navigation reste de vrais
liens `<a href>` (pas de `goto` sur clic) — accessible sans JS, cohérent avec
les e2e qui vérifient des `getByRole('link')`.

La fiche affiche un temps de lecture estimé (`estimateReadingMinutes`,
~200 mots/min sur le texte du HTML) et jusqu'à 3 « articles liés » (même
valeur de catégorie, article courant exclu — `getRelatedPosts`).

Un brouillon n'apparaît ni dans la liste ni à l'URL de son slug.

## Admin

`/admin/blog` : liste, création, édition, suppression, taxonomies. Accès
couvert par `adminHandle`. Un article peut être dépublié : il disparaît de la
vitrine sans être effacé.

## Ce qui n'est pas le blog

L'authentification, le back-office dans son ensemble, le catalogue produits
(le système de taxonomies produits `Taxonomy`/`TaxonomyValue` n'est pas
`BlogTaxonomy`/`BlogTaxonomyValue`), le panier et le checkout.

## Tests

Les numéros sont ceux des `test.step`. Changer la procédure ici, puis le spec,
puis le code (`src/lib/blog`, `/blog`, `/admin/blog`). Index :
[../../e2e/README.md](../../e2e/README.md).

### Vitrine — `e2e/blog/catalog.spec.ts`

| #   | Étape                                         | Geste                      | Preuve                                       |
| --- | --------------------------------------------- | -------------------------- | -------------------------------------------- |
| 1   | La liste affiche le titre Prisma              | GET `/blog`                | titres + lien de valeur « Catégorie »        |
| 2   | La fiche s’ouvre par slug                     | GET `/blog/[slug]`         | titre, auteur, ligne en base                 |
| 3   | Un slug inconnu renvoie 404                   | GET slug absent            | statut 404                                   |
| 4   | Un brouillon n’est pas public                 | GET slug `published=false` | statut 404, absent de la liste               |
| 5   | Pas d’UI d’édition admin                      | HTML de `/blog`            | pas de `/admin/blog` ni `passwordHash`       |
| 6   | La recherche filtre par titre                 | GET `/blog?q=`             | seul l'article correspondant                 |
| 7   | Recherche sans résultat → état vide           | GET `/blog?q=` introuvable | message « Aucun article ne correspond »      |
| 8   | Le filtre par tag ne montre que l'article lié | GET `/blog?tag=`           | article sans le tag absent                   |
| 9   | Temps de lecture + articles liés sur la fiche | GET `/blog/[slug]`         | « min de lecture », section « À lire aussi » |

### Admin — `e2e/blog/admin.spec.ts`

La création et l'édition du titre passent par Prisma : TinyMCE n'est pas joué
en e2e.

| #   | Étape                                  | Geste                        | Preuve                           |
| --- | -------------------------------------- | ---------------------------- | -------------------------------- |
| 1   | Liste admin                            | GET `/admin/blog`, recherche | ligne du tableau Articles        |
| 2   | Création Prisma visible sur la vitrine | GET `/blog`                  | heading + base                   |
| 3   | Édition Prisma du titre                | `updateBlogPostTitle`        | DB + titre sur la fiche publique |
| 4   | Suppression                            | dialogue Continue            | article absent en base           |
| 5   | Dépublier : disparaît de la vitrine    | `published=false` en Prisma  | GET slug → 404                   |

À part : CLIENT POST `?/deleteBlogPost` — l'article reste.

```bash
npm run test:e2e
```
