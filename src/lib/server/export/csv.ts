/**
 * Sérialisation CSV minimale (RFC 4180) : virgule comme séparateur, guillemets
 * doublés pour échapper `"`, champ entouré de guillemets s'il contient une
 * virgule, un guillemet ou un retour à la ligne. Volontairement sans
 * dépendance externe pour un usage aussi simple (export admin, quelques
 * milliers de lignes au plus).
 */

function escapeCsvField(value: unknown): string {
	if (value === null || value === undefined) return '';
	const str = value instanceof Date ? value.toISOString() : String(value);
	if (/[",\n\r]/.test(str)) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

export function toCsv<T extends Record<string, unknown>>(
	rows: T[],
	columns: { key: keyof T; header: string }[]
): string {
	const headerLine = columns.map((col) => escapeCsvField(col.header)).join(',');
	const lines = rows.map((row) => columns.map((col) => escapeCsvField(row[col.key])).join(','));
	// BOM UTF-8 : Excel (Windows) n'affiche correctement les accents dans un
	// CSV que si le fichier commence par cet indicateur d'encodage.
	return '\uFEFF' + [headerLine, ...lines].join('\r\n');
}
