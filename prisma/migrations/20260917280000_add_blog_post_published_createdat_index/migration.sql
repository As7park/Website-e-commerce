DROP INDEX "blog_posts_published_idx";
CREATE INDEX "blog_posts_published_createdAt_idx" ON "blog_posts"("published", "createdAt" DESC);
