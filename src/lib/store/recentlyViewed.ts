/**
 * Historique de navigation « récemment consultés », côté client uniquement
 * (localStorage) — pas de trace serveur, pas de nouvelle route. Les
 * instantanés (nom, prix, image) sont capturés au moment de la visite
 * plutôt que relus depuis un identifiant : peuvent devenir légèrement
 * périmés (prix changé, produit retiré), acceptable pour une commodité de
 * navigation, pas un chemin d'achat.
 */
export interface RecentlyViewedItem {
	id: string;
	slug: string;
	name: string;
	price: number;
	image: string | null;
}

const STORAGE_KEY = 'recently-viewed-products';
const MAX_ITEMS = 8;

export function readRecentlyViewed(): RecentlyViewedItem[] {
	if (typeof window === 'undefined') return [];
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

export function recordProductView(item: RecentlyViewedItem): void {
	if (typeof window === 'undefined') return;
	try {
		const next = [item, ...readRecentlyViewed().filter((p) => p.id !== item.id)].slice(
			0,
			MAX_ITEMS
		);
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
	} catch {
		// Stockage indisponible (navigation privée, quota) — pas bloquant.
	}
}
