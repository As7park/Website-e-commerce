import { getRedis, isRedisConfigured } from './redis';

/**
 * Disjoncteur générique (Redis si configuré, sinon repli en mémoire de
 * process — même stratégie que `lock.ts`/`rate-limit.ts`) : protège un appel
 * externe instable en arrêtant de le solliciter pendant un temps de
 * refroidissement après trop d'échecs récents, plutôt que de le marteler à
 * chaque retry QStash pendant une panne fournisseur (Sendcloud notamment).
 */

const FAILURE_THRESHOLD = 5;
const FAILURE_WINDOW_SECONDS = 120;
const OPEN_COOLDOWN_SECONDS = 60;

export class CircuitOpenError extends Error {
	constructor(name: string) {
		super(`Circuit "${name}" ouvert : trop d'échecs récents, appel court-circuité.`);
		this.name = 'CircuitOpenError';
	}
}

type MemoryState = { failures: number; windowExpiresAt: number; openUntil: number | null };
const memoryState = new Map<string, MemoryState>();

function getMemoryState(name: string): MemoryState {
	const now = Date.now();
	const state = memoryState.get(name);
	if (!state || state.windowExpiresAt < now) {
		const fresh: MemoryState = {
			failures: 0,
			windowExpiresAt: now + FAILURE_WINDOW_SECONDS * 1000,
			openUntil: null
		};
		memoryState.set(name, fresh);
		return fresh;
	}
	return state;
}

async function isOpen(name: string): Promise<boolean> {
	if (!isRedisConfigured()) {
		const state = getMemoryState(name);
		return state.openUntil !== null && state.openUntil > Date.now();
	}
	return (await getRedis().exists(`circuit:${name}:open`)) === 1;
}

async function recordFailure(name: string): Promise<void> {
	if (!isRedisConfigured()) {
		const state = getMemoryState(name);
		state.failures += 1;
		if (state.failures >= FAILURE_THRESHOLD) {
			state.openUntil = Date.now() + OPEN_COOLDOWN_SECONDS * 1000;
		}
		return;
	}

	const redis = getRedis();
	const key = `circuit:${name}:failures`;
	const failures = await redis.incr(key);
	if (failures === 1) {
		await redis.expire(key, FAILURE_WINDOW_SECONDS);
	}
	if (failures >= FAILURE_THRESHOLD) {
		await redis.set(`circuit:${name}:open`, '1', { ex: OPEN_COOLDOWN_SECONDS });
	}
}

async function recordSuccess(name: string): Promise<void> {
	if (!isRedisConfigured()) {
		memoryState.delete(name);
		return;
	}
	await Promise.all([
		getRedis().del(`circuit:${name}:failures`),
		getRedis().del(`circuit:${name}:open`)
	]);
}

/**
 * Exécute `fn()` sauf si le circuit `name` est ouvert (trop d'échecs
 * récents) : lève alors `CircuitOpenError` sans appeler `fn()`. Un succès
 * réinitialise le compteur, un échec le fait progresser vers l'ouverture.
 */
export async function withCircuitBreaker<T>(name: string, fn: () => Promise<T>): Promise<T> {
	if (await isOpen(name)) {
		throw new CircuitOpenError(name);
	}

	try {
		const result = await fn();
		await recordSuccess(name);
		return result;
	} catch (error) {
		await recordFailure(name);
		throw error;
	}
}
