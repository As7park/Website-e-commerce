-- Composite pour findPendingOrder / pendingOrderHandle (hooks.server.ts),
-- appelé sur chaque requête authentifiée, filtre userId + status ensemble.
CREATE INDEX "orders_userId_status_idx" ON "orders"("userId", "status");
