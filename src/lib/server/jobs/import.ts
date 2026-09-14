import { Role, PromoType } from '@prisma/client';
import { prisma } from '$lib/server';
import { parseCsv } from '$lib/server/export/csv';
import { EXPORT_COLUMNS, EXPORT_KINDS, EXPORT_MAX_ROWS, type ExportKind } from './export';

export type ImportKind = Exclude<ExportKind, 'sales'>;

/** Les ventes ne sont pas importables — fabriquer de fausses transactions/
 * factures via CSV est un risque d'intégrité (et potentiellement de
 * conformité) d'un tout autre ordre que purger de vieilles lignes. */
export const IMPORT_KINDS: readonly ImportKind[] = EXPORT_KINDS.filter(
	(k): k is ImportKind => k !== 'sales'
);

export interface ImportResult {
	created: number;
	updated: number;
	errors: string[];
}

function requireField(row: Record<string, string>, header: string, line: number): string {
	const value = row[header]?.trim();
	if (!value) throw new Error(`ligne ${line} : "${header}" est requis`);
	return value;
}

function optionalField(row: Record<string, string>, header: string): string | null {
	const value = row[header]?.trim();
	return value ? value : null;
}

function parseBool(row: Record<string, string>, header: string, line: number): boolean {
	const value = row[header]?.trim().toLowerCase();
	if (value === 'true') return true;
	if (value === 'false') return false;
	throw new Error(`ligne ${line} : "${header}" doit être "true" ou "false" (reçu "${value}")`);
}

function parseFloatField(row: Record<string, string>, header: string, line: number): number {
	const value = row[header]?.trim();
	const parsed = Number(value);
	if (!value || Number.isNaN(parsed)) {
		throw new Error(`ligne ${line} : "${header}" doit être un nombre (reçu "${value}")`);
	}
	return parsed;
}

function parseOptionalFloat(row: Record<string, string>, header: string, line: number): number | null {
	const value = row[header]?.trim();
	if (!value) return null;
	const parsed = Number(value);
	if (Number.isNaN(parsed)) {
		throw new Error(`ligne ${line} : "${header}" doit être un nombre (reçu "${value}")`);
	}
	return parsed;
}

function parseDateField(row: Record<string, string>, header: string, line: number): Date {
	const value = row[header]?.trim();
	const parsed = value ? new Date(value) : new Date(NaN);
	if (Number.isNaN(parsed.getTime())) {
		throw new Error(`ligne ${line} : "${header}" doit être une date ISO valide (reçu "${value}")`);
	}
	return parsed;
}

function parseOptionalDate(row: Record<string, string>, header: string, line: number): Date | null {
	const value = row[header]?.trim();
	if (!value) return null;
	return parseDateField(row, header, line);
}

async function resolveCategoryId(name: string): Promise<string> {
	const record = await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
	return record.id;
}

async function resolveBlogAuthorId(name: string): Promise<string> {
	const record = await prisma.blogAuthor.upsert({ where: { name }, update: {}, create: { name } });
	return record.id;
}

async function resolveBlogCategoryId(name: string): Promise<string> {
	const record = await prisma.blogCategory.upsert({
		where: { name },
		update: {},
		create: { name }
	});
	return record.id;
}

async function importUsersRow(row: Record<string, string>, line: number) {
	const id = requireField(row, 'ID', line);
	const email = requireField(row, 'Email', line);
	const role = requireField(row, 'Rôle', line);
	if (role !== 'ADMIN' && role !== 'CLIENT') {
		throw new Error(`ligne ${line} : "Rôle" doit être ADMIN ou CLIENT (reçu "${role}")`);
	}

	const data = {
		email,
		username: optionalField(row, 'Pseudo'),
		name: optionalField(row, 'Nom'),
		role: role as Role,
		emailVerified: parseBool(row, 'Email vérifié', line),
		isMfaEnabled: parseBool(row, '2FA activée', line),
		createdAt: parseDateField(row, 'Créé le', line)
	};

	const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } });
	await prisma.user.upsert({ where: { id }, create: { id, ...data }, update: data });
	return existing ? 'updated' : 'created';
}

async function importProductsRow(row: Record<string, string>, line: number) {
	const id = requireField(row, 'ID', line);
	const data = {
		name: requireField(row, 'Nom', line),
		slug: requireField(row, 'Slug', line),
		price: parseFloatField(row, 'Prix', line),
		stock: Math.round(parseFloatField(row, 'Stock', line)),
		description: optionalField(row, 'Description') ?? '',
		createdAt: parseDateField(row, 'Créé le', line)
	};

	const existing = await prisma.product.findUnique({ where: { id }, select: { id: true } });
	await prisma.product.upsert({
		// `colorProduct`/`images` ne sont pas des colonnes exportées (accent UI,
		// médias) : valeurs de repli à la création seulement, jamais écrasées
		// sur une ligne déjà existante.
		where: { id },
		create: { id, ...data, images: [], colorProduct: '#000000' },
		update: data
	});

	const categoryNames = (row['Catégories'] ?? '')
		.split(';')
		.map((c) => c.trim())
		.filter(Boolean);
	const categoryIds = await Promise.all(categoryNames.map(resolveCategoryId));
	await prisma.productCategory.deleteMany({ where: { productId: id } });
	if (categoryIds.length > 0) {
		await prisma.productCategory.createMany({
			data: categoryIds.map((categoryId) => ({ productId: id, categoryId })),
			skipDuplicates: true
		});
	}

	return existing ? 'updated' : 'created';
}

async function importBlogRow(row: Record<string, string>, line: number) {
	const id = requireField(row, 'ID', line);
	const authorName = requireField(row, 'Auteur', line);
	const authorId = await resolveBlogAuthorId(authorName);
	const categoryName = optionalField(row, 'Catégorie');
	const categoryId = categoryName ? await resolveBlogCategoryId(categoryName) : null;

	const data = {
		title: requireField(row, 'Titre', line),
		slug: requireField(row, 'Slug', line),
		published: parseBool(row, 'Publié', line),
		createdAt: parseDateField(row, 'Créé le', line),
		authorId,
		categoryId
	};

	const existing = await prisma.blogPost.findUnique({ where: { id }, select: { id: true } });
	await prisma.blogPost.upsert({
		where: { id },
		create: { id, ...data, content: '' },
		update: data
	});
	return existing ? 'updated' : 'created';
}

async function importPromoRow(row: Record<string, string>, line: number) {
	const id = requireField(row, 'ID', line);
	const type = requireField(row, 'Type', line);
	if (type !== 'PERCENTAGE' && type !== 'FIXED') {
		throw new Error(`ligne ${line} : "Type" doit être PERCENTAGE ou FIXED (reçu "${type}")`);
	}

	const usageLimit = parseOptionalFloat(row, "Limite d'utilisation", line);
	const data = {
		code: requireField(row, 'Code', line),
		type: type as PromoType,
		value: parseFloatField(row, 'Valeur', line),
		minAmount: parseOptionalFloat(row, 'Montant min.', line),
		usageLimit: usageLimit === null ? null : Math.round(usageLimit),
		usageCount: Math.round(parseFloatField(row, 'Utilisations', line)),
		active: parseBool(row, 'Actif', line),
		expiresAt: parseOptionalDate(row, 'Expire le', line),
		createdAt: parseDateField(row, 'Créé le', line)
	};

	const existing = await prisma.promoCode.findUnique({ where: { id }, select: { id: true } });
	await prisma.promoCode.upsert({ where: { id }, create: { id, ...data }, update: data });
	return existing ? 'updated' : 'created';
}

async function importContactsRow(row: Record<string, string>, line: number) {
	const id = requireField(row, 'ID', line);
	const data = {
		name: requireField(row, 'Nom', line),
		email: requireField(row, 'Email', line),
		subject: requireField(row, 'Sujet', line),
		message: requireField(row, 'Message', line),
		createdAt: parseDateField(row, 'Créé le', line)
	};

	const existing = await prisma.contactSubmission.findUnique({
		where: { id },
		select: { id: true }
	});
	await prisma.contactSubmission.upsert({ where: { id }, create: { id, ...data }, update: data });
	return existing ? 'updated' : 'created';
}

const ROW_IMPORTERS: Record<
	ImportKind,
	(row: Record<string, string>, line: number) => Promise<'created' | 'updated'>
> = {
	users: importUsersRow,
	products: importProductsRow,
	blog: importBlogRow,
	promo: importPromoRow,
	contacts: importContactsRow
};

/**
 * Réimporte un CSV exporté par cette même page (mêmes colonnes, voir
 * `EXPORT_COLUMNS`). Restaure les colonnes exportées uniquement — jamais les
 * secrets (un `users` réimporté n'a ni mot de passe ni clé 2FA, jamais
 * exportés au départ) ni les relations profondes (`blog` : tags et
 * commentaires ne reviennent pas, seuls les champs plats et la catégorie).
 * Une ligne invalide est consignée dans `errors` sans interrompre les
 * suivantes.
 */
export async function runImport(kind: ImportKind, csvText: string): Promise<ImportResult> {
	const expectedHeaders = EXPORT_COLUMNS[kind].map((c) => c.header);
	const rows = parseCsv(csvText, expectedHeaders);

	if (rows.length > EXPORT_MAX_ROWS) {
		throw new Error(`Fichier trop volumineux : ${rows.length} lignes (max ${EXPORT_MAX_ROWS}).`);
	}

	const importRow = ROW_IMPORTERS[kind];
	let created = 0;
	let updated = 0;
	const errors: string[] = [];

	for (let i = 0; i < rows.length; i++) {
		const line = i + 2; // ligne 1 = en-tête
		try {
			const outcome = await importRow(rows[i], line);
			if (outcome === 'created') created++;
			else updated++;
		} catch (error) {
			errors.push(error instanceof Error ? error.message : `ligne ${line} : erreur inconnue`);
		}
	}

	return { created, updated, errors };
}
