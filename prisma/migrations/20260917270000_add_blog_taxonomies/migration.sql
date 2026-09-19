-- CreateTable
CREATE TABLE "blog_taxonomies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "multiple" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_taxonomies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_taxonomy_values" (
    "id" TEXT NOT NULL,
    "taxonomyId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_taxonomy_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_post_taxonomy_values" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "taxonomyValueId" TEXT NOT NULL,

    CONSTRAINT "blog_post_taxonomy_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blog_taxonomies_name_key" ON "blog_taxonomies"("name");

-- CreateIndex
CREATE UNIQUE INDEX "blog_taxonomies_slug_key" ON "blog_taxonomies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "blog_taxonomy_values_taxonomyId_value_key" ON "blog_taxonomy_values"("taxonomyId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "blog_post_taxonomy_values_postId_taxonomyValueId_key" ON "blog_post_taxonomy_values"("postId", "taxonomyValueId");

-- CreateIndex
CREATE INDEX "blog_post_taxonomy_values_taxonomyValueId_idx" ON "blog_post_taxonomy_values"("taxonomyValueId");

-- AddForeignKey
ALTER TABLE "blog_taxonomy_values" ADD CONSTRAINT "blog_taxonomy_values_taxonomyId_fkey" FOREIGN KEY ("taxonomyId") REFERENCES "blog_taxonomies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_post_taxonomy_values" ADD CONSTRAINT "blog_post_taxonomy_values_postId_fkey" FOREIGN KEY ("postId") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_post_taxonomy_values" ADD CONSTRAINT "blog_post_taxonomy_values_taxonomyValueId_fkey" FOREIGN KEY ("taxonomyValueId") REFERENCES "blog_taxonomy_values"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill : convertit les BlogCategory (mono-valeur) et BlogTag (multi-valeur)
-- historiques vers le système générique. Les anciennes tables `blog_categories`,
-- `blog_tags`, `blog_post_tags` et `blog_posts`.`categoryId` ne sont
-- volontairement PAS touchées ici — leur retrait se fait dans une migration
-- séparée, une fois la bascule applicative vérifiée (voir docs/blog/README.md).
INSERT INTO "blog_taxonomies" ("id", "name", "slug", "multiple")
VALUES
  (gen_random_uuid()::text, 'Catégorie', 'categorie', false),
  (gen_random_uuid()::text, 'Tag', 'tag', true);

-- Backfill : valeurs « Catégorie » depuis "blog_categories".
INSERT INTO "blog_taxonomy_values" ("id", "taxonomyId", "value")
SELECT gen_random_uuid()::text, (SELECT "id" FROM "blog_taxonomies" WHERE "slug" = 'categorie'), c."name"
FROM "blog_categories" c;

-- Backfill : valeurs « Tag » depuis "blog_tags".
INSERT INTO "blog_taxonomy_values" ("id", "taxonomyId", "value")
SELECT gen_random_uuid()::text, (SELECT "id" FROM "blog_taxonomies" WHERE "slug" = 'tag'), t."name"
FROM "blog_tags" t;

-- Backfill : assignations « Catégorie » depuis "blog_posts"."categoryId".
INSERT INTO "blog_post_taxonomy_values" ("id", "postId", "taxonomyValueId")
SELECT gen_random_uuid()::text, p."id", tv."id"
FROM "blog_posts" p
JOIN "blog_categories" c ON c."id" = p."categoryId"
JOIN "blog_taxonomy_values" tv ON tv."taxonomyId" = (SELECT "id" FROM "blog_taxonomies" WHERE "slug" = 'categorie') AND tv."value" = c."name";

-- Backfill : assignations « Tag » depuis "blog_post_tags".
INSERT INTO "blog_post_taxonomy_values" ("id", "postId", "taxonomyValueId")
SELECT gen_random_uuid()::text, bpt."postId", tv."id"
FROM "blog_post_tags" bpt
JOIN "blog_tags" t ON t."id" = bpt."tagId"
JOIN "blog_taxonomy_values" tv ON tv."taxonomyId" = (SELECT "id" FROM "blog_taxonomies" WHERE "slug" = 'tag') AND tv."value" = t."name";
