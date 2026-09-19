// -----------------------------------------------------------------------------
// Estimation du colis (poids + dimensions) à partir des articles du panier /
// de la commande. Module isomorphe (aucune dépendance serveur) : utilisé à la
// fois par le devis checkout (`/api/sendcloud/shipping-options`) et par la
// création réelle de la commande Sendcloud après paiement
// (`$lib/server/jobs/post-payment.ts`) — source unique, pour que le devis
// affiché au client corresponde exactement au colis réellement expédié.
//
// `Product.weight/length/width/height` sont nullable : tant que le catalogue
// n'est pas rempli, on retombe sur `DEFAULT_ITEM` (gabarit bijou standard).
// -----------------------------------------------------------------------------

export interface PackageItemInput {
	quantity: number;
	/** Une ligne personnalisée ajoute un emballage supplémentaire. */
	hasCustom?: boolean;
	product?: {
		weight?: number | null;
		length?: number | null;
		width?: number | null;
		height?: number | null;
	} | null;
}

export interface PackageEstimate {
	weightKg: number;
	lengthCm: number;
	widthCm: number;
	heightCm: number;
}

const DEFAULT_ITEM = { weightKg: 0.124, lengthCm: 10, widthCm: 8, heightCm: 4 };
const CUSTOM_EXTRA_WEIGHT_KG = 0.666;

interface BoxSize {
	lengthCm: number;
	widthCm: number;
	heightCm: number;
}

/** Cartons standard disponibles, du plus petit au plus grand. */
const STANDARD_BOXES: BoxSize[] = [
	{ lengthCm: 30, widthCm: 20, heightCm: 15 },
	{ lengthCm: 40, widthCm: 30, heightCm: 20 },
	{ lengthCm: 50, widthCm: 30, heightCm: 30 },
	{ lengthCm: 60, widthCm: 40, heightCm: 40 }
];

function volumeCm3(box: BoxSize): number {
	return box.lengthCm * box.widthCm * box.heightCm;
}

/**
 * Choisit le plus petit carton standard dont le volume contient le volume
 * total des articles et dont la plus grande arête est au moins aussi grande
 * que la plus grande dimension d'un seul article (pas de bin-packing 3D réel :
 * approximation volontairement simple, suffisante pour des objets de petite
 * taille comme des bijoux).
 */
function pickBox(totalVolumeCm3: number, maxItemDimCm: number): BoxSize {
	const fitting = STANDARD_BOXES.find(
		(box) =>
			volumeCm3(box) >= totalVolumeCm3 &&
			Math.max(box.lengthCm, box.widthCm, box.heightCm) >= maxItemDimCm
	);
	return fitting ?? STANDARD_BOXES[STANDARD_BOXES.length - 1];
}

export function estimatePackage(items: PackageItemInput[]): PackageEstimate {
	let weightKg = 0;
	let totalVolumeCm3 = 0;
	let maxItemDimCm = 0;

	for (const item of items) {
		const weight = item.product?.weight ?? DEFAULT_ITEM.weightKg;
		const length = item.product?.length ?? DEFAULT_ITEM.lengthCm;
		const width = item.product?.width ?? DEFAULT_ITEM.widthCm;
		const height = item.product?.height ?? DEFAULT_ITEM.heightCm;

		weightKg += weight * item.quantity;
		if (item.hasCustom) weightKg += CUSTOM_EXTRA_WEIGHT_KG;

		totalVolumeCm3 += length * width * height * item.quantity;
		maxItemDimCm = Math.max(maxItemDimCm, length, width, height);
	}

	const box = pickBox(totalVolumeCm3, maxItemDimCm);

	return {
		weightKg: Math.round(weightKg * 1000) / 1000,
		lengthCm: box.lengthCm,
		widthCm: box.widthCm,
		heightCm: box.heightCm
	};
}
