/**
 * `Product.price`/`ProductVariant.price` sont stockés HT (le panier calcule
 * la TVA séparément, voir `$lib/server/vat.ts`) — cette conversion est
 * uniquement pour l'affichage au client, jamais pour le calcul panier/commande
 * (Arrêté du 3 déc. 1987 : le prix annoncé au consommateur doit être TTC).
 */
export function toTTC(priceHT: number, vatRate: number): number {
	return priceHT * (1 + vatRate);
}
