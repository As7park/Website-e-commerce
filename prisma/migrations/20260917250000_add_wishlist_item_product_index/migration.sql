-- Index manquant pour listWishlistItemsForProduct (scan complet sinon,
-- l'unique (userId, productId) ne couvre pas productId seul).
CREATE INDEX "wishlist_items_productId_idx" ON "wishlist_items"("productId");
