/**
 * Détection de fraude simple (`StoreSettings.fraudDetectionEnabled`) —
 * calcule un score de risque avant paiement, jamais après : `checkout`
 * (`src/routes/checkout/+page.server.ts`) appelle `computeFraudScore` juste
 * avant de créer la session Stripe Checkout et, si `fraudBlockingEnabled`
 * est aussi actif, n'ouvre jamais de session quand le niveau atteint `high`.
 * Aucune capture Stripe manuelle : voir `docs/commerce/README.md` pour le
 * choix « blocage avant paiement plutôt que capture différée ».
 *
 * Trois facteurs, poids fixes (pas de seuils configurables en admin, même
 * convention que `ABANDONED_ORDER_DAYS`/`REVIEW_REMINDER_DELAY_DAYS`
 * ailleurs dans ce projet).
 */
import { prisma } from '$lib/server';
import { isDisposableEmailDomain } from '$lib/server/fraud/disposableEmailDomains';

export const VELOCITY_WINDOW_HOURS = 24;
export const VELOCITY_THRESHOLD = 3;
export const VELOCITY_SCORE = 40;

export const ADDRESS_COUNTRY_MISMATCH_SCORE = 30;
export const ADDRESS_LOCAL_MISMATCH_SCORE = 15;

export const DISPOSABLE_EMAIL_SCORE = 30;

export const RISK_LEVEL_MEDIUM_THRESHOLD = 30;
export const RISK_LEVEL_HIGH_THRESHOLD = 60;

export type RiskLevel = 'low' | 'medium' | 'high';

export interface FraudCheckInput {
	userId: string;
	userEmail: string;
	shippingAddressId: string;
	billingAddressId: string;
}

export interface FraudCheckResult {
	score: number;
	level: RiskLevel;
	factors: string[];
}

function levelFromScore(score: number): RiskLevel {
	if (score >= RISK_LEVEL_HIGH_THRESHOLD) return 'high';
	if (score >= RISK_LEVEL_MEDIUM_THRESHOLD) return 'medium';
	return 'low';
}

/**
 * Vélocité : nombre de `Transaction` (commandes réellement payées, pas les
 * `Order` PENDING — un panier créé en continu par une navigation normale
 * serait un signal bruité) de ce compte sur la fenêtre `VELOCITY_WINDOW_HOURS`.
 * Réutilise l'index déjà en place (`Transaction.@@index([userId, createdAt])`).
 */
async function velocityScore(userId: string): Promise<{ score: number; triggered: boolean }> {
	const cutoff = new Date(Date.now() - VELOCITY_WINDOW_HOURS * 60 * 60 * 1000);
	const recentCount = await prisma.transaction.count({
		where: { userId, createdAt: { gte: cutoff } }
	});
	const triggered = recentCount >= VELOCITY_THRESHOLD;
	return { score: triggered ? VELOCITY_SCORE : 0, triggered };
}

/**
 * Écart adresse facturation/livraison : aucun écart si c'est la même ligne
 * `Address` (cas le plus courant, défaut au checkout). Sinon, pays différent
 * pèse plus lourd qu'un simple écart de ville/code postal dans le même pays.
 */
async function addressMismatchScore(
	shippingAddressId: string,
	billingAddressId: string
): Promise<{ score: number; triggered: boolean }> {
	if (shippingAddressId === billingAddressId) return { score: 0, triggered: false };

	const [shipping, billing] = await Promise.all([
		prisma.address.findUnique({ where: { id: shippingAddressId } }),
		prisma.address.findUnique({ where: { id: billingAddressId } })
	]);
	if (!shipping || !billing) return { score: 0, triggered: false };

	if (shipping.country_code !== billing.country_code) {
		return { score: ADDRESS_COUNTRY_MISMATCH_SCORE, triggered: true };
	}
	if (shipping.zip !== billing.zip || shipping.city !== billing.city) {
		return { score: ADDRESS_LOCAL_MISMATCH_SCORE, triggered: true };
	}
	return { score: 0, triggered: false };
}

export async function computeFraudScore(input: FraudCheckInput): Promise<FraudCheckResult> {
	const factors: string[] = [];
	let score = 0;

	const velocity = await velocityScore(input.userId);
	if (velocity.triggered) {
		score += velocity.score;
		factors.push('Vélocité de commandes');
	}

	const addressMismatch = await addressMismatchScore(
		input.shippingAddressId,
		input.billingAddressId
	);
	if (addressMismatch.triggered) {
		score += addressMismatch.score;
		factors.push('Écart adresse facturation/livraison');
	}

	if (isDisposableEmailDomain(input.userEmail)) {
		score += DISPOSABLE_EMAIL_SCORE;
		factors.push('E-mail jetable');
	}

	score = Math.min(100, score);

	return { score, level: levelFromScore(score), factors };
}

const RISK_LEVEL_LABELS: Record<string, string> = {
	low: 'Faible',
	medium: 'Moyen',
	high: 'Élevé'
};

export function formatRiskLevel(level: string | null | undefined): string {
	if (!level) return '—';
	return RISK_LEVEL_LABELS[level] ?? level;
}
