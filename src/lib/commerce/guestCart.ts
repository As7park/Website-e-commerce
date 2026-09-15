// -----------------------------------------------------------------------------
// Panier invité (navigateur).
//
// COMMERCE-PLUGIN : sans compte, les lignes vivent dans `localStorage`. Dès
// qu'une session existe, elles sont fusionnées dans l'`Order` PENDING via
// `/api/save-cart` (prix relus serveur). Ce n'est pas une source de vérité
// comptable.
// -----------------------------------------------------------------------------

export const GUEST_CART_KEY = 'commerce:guest-cart';

export type GuestCustom = {
	id?: string;
	image: string;
	userMessage: string;
};

export type GuestCartLine = {
	productId: string;
	quantity: number;
	custom?: GuestCustom[];
	/** Snapshot d'affichage uniquement — le serveur ignore le prix. */
	name?: string;
	images?: string;
	stock?: number;
	unitPrice?: number;
	/**
	 * Variante sélectionnée : une ligne invité avec `variantId` est distincte
	 * d'une ligne du même `productId` sans variante (ou avec une autre
	 * variante) — voir `mergeItems`, indexé sur les deux ensemble.
	 */
	variantId?: string;
	variantLabel?: string;
	variantPrice?: number;
	variantStock?: number;
};

export type GuestCart = {
	items: GuestCartLine[];
};

export type MergeLine = {
	id?: string;
	productId: string;
	quantity: number;
	stock?: number;
	custom?: GuestCustom[];
	variantId?: string;
};

export type StoreCartItem = {
	id: string;
	product: {
		id: string;
		name: string;
		price: number;
		images: string;
		stock: number;
	};
	variant?: {
		id: string;
		label: string;
		price: number;
		stock: number;
	};
	quantity: number;
	price: number;
	custom?: Array<{ id: string; image: string; userMessage: string }>;
};

function storage(): Storage | null {
	try {
		if (typeof localStorage === 'undefined') return null;
		return localStorage;
	} catch {
		return null;
	}
}

export function readGuestCart(): GuestCart {
	const raw = storage()?.getItem(GUEST_CART_KEY);
	if (!raw) return { items: [] };

	try {
		const parsed = JSON.parse(raw) as { items?: unknown };
		if (!Array.isArray(parsed?.items)) return { items: [] };

		const items: GuestCartLine[] = [];
		for (const entry of parsed.items) {
			if (!entry || typeof entry !== 'object') continue;
			const line = entry as GuestCartLine;
			if (typeof line.productId !== 'string' || !line.productId) continue;
			const quantity = Math.max(1, Math.trunc(Number(line.quantity) || 1));
			items.push({
				productId: line.productId,
				quantity,
				custom: Array.isArray(line.custom) ? line.custom : undefined,
				name: line.name,
				images: line.images,
				stock: typeof line.stock === 'number' ? line.stock : undefined,
				unitPrice: typeof line.unitPrice === 'number' ? line.unitPrice : undefined,
				variantId: typeof line.variantId === 'string' ? line.variantId : undefined,
				variantLabel: typeof line.variantLabel === 'string' ? line.variantLabel : undefined,
				variantPrice: typeof line.variantPrice === 'number' ? line.variantPrice : undefined,
				variantStock: typeof line.variantStock === 'number' ? line.variantStock : undefined
			});
		}
		return { items };
	} catch {
		return { items: [] };
	}
}

export function writeGuestCart(cart: GuestCart): void {
	if (cart.items.length === 0) {
		clearGuestCart();
		return;
	}
	const store = storage();
	if (!store) return;
	try {
		store.setItem(GUEST_CART_KEY, JSON.stringify({ items: cart.items }));
	} catch {
		// Quota ou mode privé : le panier reste en mémoire le temps de la page.
	}
}

export function clearGuestCart(): void {
	storage()?.removeItem(GUEST_CART_KEY);
}

export function storeItemsToGuest(items: StoreCartItem[]): GuestCartLine[] {
	return items
		.filter((item) => item.product?.id)
		.map((item) => ({
			productId: item.product.id,
			quantity: item.quantity,
			custom: item.custom,
			name: item.product.name,
			images: item.product.images,
			stock: item.product.stock,
			unitPrice: item.product.price,
			variantId: item.variant?.id,
			variantLabel: item.variant?.label,
			variantPrice: item.variant?.price,
			variantStock: item.variant?.stock
		}));
}

export function guestToStoreItems(guest: GuestCart): StoreCartItem[] {
	return guest.items.map((line) => {
		const price = line.variantId ? (line.variantPrice ?? line.unitPrice ?? 0) : (line.unitPrice ?? 0);
		return {
			id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : line.productId,
			product: {
				id: line.productId,
				name: line.name ?? '',
				price: line.unitPrice ?? 0,
				images: line.images ?? '',
				stock: line.stock ?? 0
			},
			variant: line.variantId
				? {
						id: line.variantId,
						label: line.variantLabel ?? '',
						price,
						stock: line.variantStock ?? 0
					}
				: undefined,
			quantity: line.quantity,
			price,
			custom: line.custom?.map((entry) => ({
				id: entry.id ?? '',
				image: entry.image,
				userMessage: entry.userMessage
			}))
		};
	});
}

export function totalsFromItems(items: StoreCartItem[]): { subtotal: number; tax: number } {
	const subtotal = items.reduce(
		(sum, item) => sum + (item.variant?.price ?? item.product.price) * item.quantity,
		0
	);
	const tax = parseFloat((subtotal * 0.055).toFixed(2));
	return { subtotal, tax };
}

/**
 * Union par `productId` + `variantId` (deux variantes du même produit sont
 * des lignes distinctes, jamais fusionnées entre elles). Quantités
 * additionnées, plafonnées au stock connu. La ligne serveur garde son `id`
 * pour que `updateOrderItems` fasse un upsert.
 */
export function mergeItems(server: MergeLine[], guest: MergeLine[]): MergeLine[] {
	const lineKey = (line: MergeLine) => `${line.productId}:${line.variantId ?? ''}`;
	const byLine = new Map<string, MergeLine>();

	for (const line of server) {
		if (!line.productId) continue;
		byLine.set(lineKey(line), { ...line });
	}

	for (const line of guest) {
		if (!line.productId) continue;
		const existing = byLine.get(lineKey(line));
		if (!existing) {
			byLine.set(lineKey(line), {
				productId: line.productId,
				quantity: line.quantity,
				stock: line.stock,
				custom: line.custom,
				variantId: line.variantId
			});
			continue;
		}

		const stock = existing.stock ?? line.stock;
		const summed = existing.quantity + line.quantity;
		existing.quantity = typeof stock === 'number' && stock >= 0 ? Math.min(summed, stock) : summed;
	}

	return [...byLine.values()];
}

export function toSaveCartItems(lines: MergeLine[]) {
	return lines.map((line) => ({
		id: line.id,
		product: { id: line.productId },
		productId: line.productId,
		variantId: line.variantId,
		quantity: line.quantity,
		custom: line.custom
	}));
}

export function publicItemsToMergeLines(
	items: Array<{
		id: string;
		quantity: number;
		custom?: GuestCustom[];
		product: { id: string; stock: number };
		variant?: { id: string; stock: number } | null;
	}>
): MergeLine[] {
	return items.map((item) => ({
		id: item.id,
		productId: item.product.id,
		quantity: item.quantity,
		stock: item.variant?.stock ?? item.product.stock,
		custom: item.custom,
		variantId: item.variant?.id
	}));
}

export function guestToMergeLines(guest: GuestCart): MergeLine[] {
	return guest.items.map((line) => ({
		productId: line.productId,
		quantity: line.quantity,
		stock: line.variantId ? line.variantStock : line.stock,
		custom: line.custom,
		variantId: line.variantId
	}));
}

/** Adapte la réponse Prisma de `/api/save-cart` au store client. */
export function serverOrderToStore(order: {
	id: string;
	userId: string;
	subtotal: number;
	tax: number;
	shippingCost?: number | null;
	items?: Array<{
		id: string;
		quantity: number;
		price: number;
		custom?: Array<{ id: string; image: string; userMessage: string }>;
		product?: {
			id: string;
			name: string;
			price: number;
			images: string[] | string;
			stock: number;
		} | null;
		variant?: {
			id: string;
			label: string;
			price: number | null;
			stock: number;
		} | null;
	}>;
}): {
	id: string;
	userId: string;
	subtotal: number;
	tax: number;
	shippingCost: number;
	items: StoreCartItem[];
} {
	return {
		id: order.id,
		userId: order.userId,
		subtotal: order.subtotal,
		tax: order.tax,
		shippingCost: order.shippingCost ?? 0,
		items: (order.items ?? []).map((item) => {
			const images = item.product?.images;
			const image =
				typeof images === 'string' ? images : Array.isArray(images) ? (images[0] ?? '') : '';
			return {
				id: item.id,
				product: {
					id: item.product?.id ?? '',
					name: item.product?.name ?? '',
					price: item.product?.price ?? item.price,
					images: image,
					stock: item.product?.stock ?? 0
				},
				variant: item.variant
					? {
							id: item.variant.id,
							label: item.variant.label,
							price: item.variant.price ?? item.product?.price ?? item.price,
							stock: item.variant.stock
						}
					: undefined,
				quantity: item.quantity,
				price: item.price,
				custom: item.custom
			};
		})
	};
}
