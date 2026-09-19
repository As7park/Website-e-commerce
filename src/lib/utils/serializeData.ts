// Générique conservé (au lieu de `unknown` en retour) : la fonction ne change
// pas la forme de son entrée (Date -> string ISO, Uint8Array -> base64 mis à
// part), les appelants comptent sur le type précis d'origine (ex.
// `serializeData(userFetched)` doit rester utilisable comme `userFetched`).
export const serializeData = <T>(obj: T): T => {
	if (!obj || typeof obj !== 'object') return obj;

	if (obj instanceof Date) {
		return obj.toISOString() as unknown as T;
	}

	if (obj instanceof Uint8Array) {
		return Buffer.from(obj).toString('base64') as unknown as T; // Base64 pour Uint8Array
	}

	if (Array.isArray(obj)) {
		return obj.map(serializeData) as unknown as T;
	}

	return Object.fromEntries(
		Object.entries(obj).map(([key, value]) => [
			key,
			serializeData(value !== undefined ? value : null)
		])
	) as T;
};
