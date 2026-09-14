import { getRedis, isRedisConfigured } from './redis';

/**
 * Compteur de tentatives par job (Redis si configuré, sinon repli en
 * mémoire de process) : sert de garde-fou contre un retry QStash infini —
 * après `maxAttempts` échecs pour la même clé (ex: une transaction), le job
 * appelant doit arrêter de relancer et journaliser pour investigation
 * manuelle (dead-letter), plutôt que de retenter indéfiniment.
 */

const ATTEMPTS_TTL_SECONDS = 60 * 60 * 24; // 24h : purge automatique des tentatives passées

const memoryAttempts = new Map<string, number>();

export async function recordJobAttempt(
	key: string,
	maxAttempts: number
): Promise<{ attempt: number; exhausted: boolean }> {
	if (!isRedisConfigured()) {
		const attempt = (memoryAttempts.get(key) ?? 0) + 1;
		memoryAttempts.set(key, attempt);
		return { attempt, exhausted: attempt >= maxAttempts };
	}

	const redis = getRedis();
	const redisKey = `job-attempts:${key}`;
	const attempt = await redis.incr(redisKey);
	if (attempt === 1) {
		await redis.expire(redisKey, ATTEMPTS_TTL_SECONDS);
	}
	return { attempt, exhausted: attempt >= maxAttempts };
}

export async function resetJobAttempts(key: string): Promise<void> {
	if (!isRedisConfigured()) {
		memoryAttempts.delete(key);
		return;
	}
	await getRedis().del(`job-attempts:${key}`);
}
