import { getRedis, isRedisConfigured } from './redis';

/**
 * Compteurs applicatifs légers (Redis si configuré, sinon repli en mémoire
 * de process — mêmes limites que le reste : pas partagé entre instances
 * sans Redis, utile seulement pour un coup d'œil en dev).
 *
 * Objectif : donner un signal minimal sous charge (taux de cache-hit,
 * rejets de rate-limit, contentions de verrou, durée des jobs QStash) sans
 * dépendre d'un service de métriques externe. Pour un suivi plus poussé
 * (dashboards, alerting sur seuils), Sentry (déjà en place) ou un vrai
 * backend de métriques restent le complément naturel.
 */

const METRICS_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 jours : suffisant pour un coup d'œil, pas un historique long terme
const KNOWN_COUNTERS_KEY = 'metrics:known-counters';
const KNOWN_DURATIONS_KEY = 'metrics:known-durations';

const memoryCounters = new Map<string, number>();
const memoryDurations = new Map<string, { count: number; totalMs: number }>();

export async function incrementMetric(name: string, by = 1): Promise<void> {
	if (!isRedisConfigured()) {
		memoryCounters.set(name, (memoryCounters.get(name) ?? 0) + by);
		return;
	}
	const redis = getRedis();
	const key = `metrics:count:${name}`;
	const [value] = await Promise.all([redis.incrby(key, by), redis.sadd(KNOWN_COUNTERS_KEY, name)]);
	if (value === by) {
		await redis.expire(key, METRICS_TTL_SECONDS);
	}
}

export async function recordDuration(name: string, ms: number): Promise<void> {
	if (!isRedisConfigured()) {
		const state = memoryDurations.get(name) ?? { count: 0, totalMs: 0 };
		state.count += 1;
		state.totalMs += ms;
		memoryDurations.set(name, state);
		return;
	}
	const redis = getRedis();
	const key = `metrics:duration:${name}`;
	const [count] = await Promise.all([
		redis.hincrby(key, 'count', 1),
		redis.hincrby(key, 'totalMs', Math.round(ms)),
		redis.sadd(KNOWN_DURATIONS_KEY, name)
	]);
	if (count === 1) {
		await redis.expire(key, METRICS_TTL_SECONDS);
	}
}

/** Mesure la durée de `fn()` et l'enregistre sous `name`, quel que soit le résultat. */
export async function withDuration<T>(name: string, fn: () => Promise<T>): Promise<T> {
	const start = Date.now();
	try {
		return await fn();
	} finally {
		await recordDuration(name, Date.now() - start);
	}
}

export type MetricsSnapshot = {
	counters: Record<string, number>;
	durations: Record<string, { count: number; avgMs: number }>;
};

/**
 * Lit l'ensemble des compteurs/durées déjà observés au moins une fois — pas
 * de liste figée à l'avance : un nouveau `incrementMetric`/`recordDuration`
 * apparaît ici automatiquement dès son premier appel (voir `KNOWN_*_KEY`).
 */
export async function getMetricsSnapshot(): Promise<MetricsSnapshot> {
	if (!isRedisConfigured()) {
		const counters = Object.fromEntries(memoryCounters);
		const durations = Object.fromEntries(
			[...memoryDurations].map(([name, state]) => [
				name,
				{ count: state.count, avgMs: state.count ? Math.round(state.totalMs / state.count) : 0 }
			])
		);
		return { counters, durations };
	}

	const redis = getRedis();
	const [counterNames, durationNames] = await Promise.all([
		redis.smembers(KNOWN_COUNTERS_KEY),
		redis.smembers(KNOWN_DURATIONS_KEY)
	]);

	const counters: Record<string, number> = {};
	const durations: Record<string, { count: number; avgMs: number }> = {};

	await Promise.all(
		counterNames.map(async (name) => {
			counters[name] = (await redis.get<number>(`metrics:count:${name}`)) ?? 0;
		})
	);
	await Promise.all(
		durationNames.map(async (name) => {
			const data = await redis.hgetall<{ count: string; totalMs: string }>(
				`metrics:duration:${name}`
			);
			const count = Number(data?.count ?? 0);
			const totalMs = Number(data?.totalMs ?? 0);
			durations[name] = { count, avgMs: count ? Math.round(totalMs / count) : 0 };
		})
	);

	return { counters, durations };
}
