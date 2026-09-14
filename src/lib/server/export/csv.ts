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

/**
 * D\u00E9coupe une ligne CSV RFC 4180 (guillemets doubl\u00E9s pour \u00E9chapper `"`, champ
 * entre guillemets s'il contient une virgule/un guillemet/un saut de ligne).
 * Prend le texte COMPLET du fichier (pas une ligne pr\u00E9-coup\u00E9e) car un champ
 * entre guillemets peut lui-m\u00EAme contenir des sauts de ligne.
 */
function splitCsvRows(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let inQuotes = false;

	for (let i = 0; i < text.length; i++) {
		const char = text[i];

		if (inQuotes) {
			if (char === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				field += char;
			}
			continue;
		}

		if (char === '"') {
			inQuotes = true;
		} else if (char === ',') {
			row.push(field);
			field = '';
		} else if (char === '\r') {
			// g\u00E9r\u00E9 par le `\n` qui suit (CRLF) ou seul (vieux Mac, rarissime) \u2014
			// dans les deux cas on cl\u00F4t la ligne au `\n`/\u00E0 la fin de cha\u00EEne.
			continue;
		} else if (char === '\n') {
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else {
			field += char;
		}
	}

	// Derni\u00E8re ligne sans retour final.
	if (field.length > 0 || row.length > 0) {
		row.push(field);
		rows.push(row);
	}

	return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

/**
 * Parse un CSV produit par `toCsv` (m\u00EAme \u00E9chappement, BOM UTF-8 en t\u00EAte) en
 * tableau d'objets index\u00E9s par l'en-t\u00EAte exact. L\u00E8ve si l'en-t\u00EAte ne
 * correspond pas exactement \u00E0 `expectedHeaders` (ordre et libell\u00E9s) : mieux
 * vaut un rejet net qu'un import qui associe silencieusement la mauvaise
 * colonne \u00E0 la mauvaise cl\u00E9.
 */
export function parseCsv(text: string, expectedHeaders: string[]): Record<string, string>[] {
	const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
	const rows = splitCsvRows(withoutBom);
	if (rows.length === 0) {
		throw new Error('Fichier CSV vide.');
	}

	const [header, ...dataRows] = rows;
	const headerMatches =
		header.length === expectedHeaders.length &&
		header.every((col, i) => col === expectedHeaders[i]);
	if (!headerMatches) {
		throw new Error(
			`En-t\u00EAte CSV inattendu. Attendu : ${expectedHeaders.join(', ')}. Re\u00E7u : ${header.join(', ')}.`
		);
	}

	return dataRows.map((row) =>
		Object.fromEntries(expectedHeaders.map((key, i) => [key, row[i] ?? '']))
	);
}
