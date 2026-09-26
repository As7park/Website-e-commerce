import { AsyncLocalStorage } from 'node:async_hooks';
import pino from 'pino';
import { dev } from '$app/environment';

/** Passe à `true` pour tracer les logs DEBUG. */
export const DEBUG = false;

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const PINO_LEVEL: Record<LogLevel, 'debug' | 'info' | 'warn' | 'error'> = {
	DEBUG: 'debug',
	INFO: 'info',
	WARN: 'warn',
	ERROR: 'error'
};

// `pino-pretty` tourne dans un worker thread : jamais activé en build de
// production (le bundler serverless n'embarque pas forcément ce worker), la
// sortie prod reste du JSON brut sur stdout, ingérable tel quel par n'importe
// quel collecteur de logs (Vercel, Better Stack, Datadog...).
const base = pino({
	level: 'debug',
	transport: dev ? { target: 'pino-pretty', options: { colorize: true } } : undefined
});

/**
 * Corrélation par requête : `hooks.server.ts` ouvre un contexte par requête
 * HTTP (`withRequestId`), tout `log(...)` appelé pendant sa résolution —
 * même dans un module métier profondément imbriqué — récupère automatiquement
 * le même `requestId`, sans avoir à le faire transiter en paramètre partout.
 */
const requestContext = new AsyncLocalStorage<{ requestId: string }>();

export function withRequestId<T>(requestId: string, run: () => T): T {
	return requestContext.run({ requestId }, run);
}

export function currentRequestId(): string | undefined {
	return requestContext.getStore()?.requestId;
}

/**
 * Même signature qu'avant (level, context, ...args) : aucun appelant existant
 * n'a besoin de changer. Le premier argument variadique sert de message si
 * c'est une chaîne, tout le reste part en données structurées.
 */
export function log(level: LogLevel, context: string, ...args: unknown[]) {
	if (!DEBUG && level === 'DEBUG') return;

	const [first, ...rest] = args;
	const hasMessage = typeof first === 'string';
	const message = hasMessage ? first : context;
	// Pino ne sérialise une `Error` que sous la clé `err` : rangée dans
	// `data`, elle sortirait en `{}` (ses propriétés ne sont pas énumérables).
	const data = (hasMessage ? rest : args).map((item) =>
		item instanceof Error ? pino.stdSerializers.err(item) : item
	);

	const requestId = currentRequestId();
	base[PINO_LEVEL[level]](
		{ context, ...(requestId ? { requestId } : {}), ...(data.length ? { data } : {}) },
		message
	);
}
