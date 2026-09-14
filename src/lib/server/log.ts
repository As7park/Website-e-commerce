/** Passe à `true` pour tracer les logs DEBUG dans la console. */
export const DEBUG = false;

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export function log(level: LogLevel, context: string, ...args: unknown[]) {
	if (!DEBUG && level === 'DEBUG') return;

	const prefix = `[${new Date().toISOString()}] [${level}] [${context}]`;
	if (level === 'ERROR') console.error(prefix, ...args);
	else if (level === 'WARN') console.warn(prefix, ...args);
	else if (level === 'INFO') console.info(prefix, ...args);
	else console.debug(prefix, ...args);
}
