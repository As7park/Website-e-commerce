import { prisma } from '$lib/server';
import { toCsv } from '$lib/server/export/csv';

export type ExportKind = 'sales' | 'users' | 'products' | 'blog' | 'promo' | 'contacts';

export const EXPORT_KINDS: readonly ExportKind[] = [
	'sales',
	'users',
	'products',
	'blog',
	'promo',
	'contacts'
];

/** Fenêtre volontairement large pour un export (contrairement au dashboard,
 * borné à 12 mois) : un admin qui exporte veut typiquement l'historique
 * complet. Le plafond ci-dessous reste un filet contre un volume démesuré
 * — et le plafond appliqué en import (`$lib/server/jobs/import.ts`). */
export const EXPORT_MAX_ROWS = 20000;

/**
 * Colonnes par kind : `key` sert à `toCsv` (lecture depuis l'objet Prisma
 * projeté), `header` est le libellé de colonne — source de vérité unique
 * partagée avec `parseCsv` à l'import (`$lib/server/jobs/import.ts`), pour
 * qu'export et import ne puissent jamais diverger sur les noms de colonnes.
 */
export const EXPORT_COLUMNS = {
	sales: [
		{ key: 'id', header: 'ID transaction' },
		{ key: 'invoiceNumber', header: 'N° facture' },
		{ key: 'createdAt', header: 'Date' },
		{ key: 'status', header: 'Statut' },
		{ key: 'amount', header: 'Montant' },
		{ key: 'currency', header: 'Devise' },
		{ key: 'customer_details_name', header: 'Client' },
		{ key: 'customer_details_email', header: 'Email client' },
		{ key: 'shippingOption', header: 'Mode de livraison' },
		{ key: 'shippingCost', header: 'Frais de port' },
		{ key: 'trackingNumber', header: 'N° de suivi' }
	],
	users: [
		{ key: 'id', header: 'ID' },
		{ key: 'email', header: 'Email' },
		{ key: 'username', header: 'Pseudo' },
		{ key: 'name', header: 'Nom' },
		{ key: 'role', header: 'Rôle' },
		{ key: 'emailVerified', header: 'Email vérifié' },
		{ key: 'isMfaEnabled', header: '2FA activée' },
		{ key: 'createdAt', header: 'Créé le' }
	],
	products: [
		{ key: 'id', header: 'ID' },
		{ key: 'name', header: 'Nom' },
		{ key: 'slug', header: 'Slug' },
		{ key: 'price', header: 'Prix' },
		{ key: 'stock', header: 'Stock' },
		{ key: 'categories', header: 'Catégories' },
		{ key: 'description', header: 'Description' },
		{ key: 'createdAt', header: 'Créé le' }
	],
	blog: [
		{ key: 'id', header: 'ID' },
		{ key: 'title', header: 'Titre' },
		{ key: 'slug', header: 'Slug' },
		{ key: 'author', header: 'Auteur' },
		{ key: 'category', header: 'Catégorie' },
		{ key: 'published', header: 'Publié' },
		{ key: 'createdAt', header: 'Créé le' }
	],
	promo: [
		{ key: 'id', header: 'ID' },
		{ key: 'code', header: 'Code' },
		{ key: 'type', header: 'Type' },
		{ key: 'value', header: 'Valeur' },
		{ key: 'minAmount', header: 'Montant min.' },
		{ key: 'usageLimit', header: "Limite d'utilisation" },
		{ key: 'usageCount', header: 'Utilisations' },
		{ key: 'active', header: 'Actif' },
		{ key: 'expiresAt', header: 'Expire le' },
		{ key: 'createdAt', header: 'Créé le' }
	],
	contacts: [
		{ key: 'id', header: 'ID' },
		{ key: 'name', header: 'Nom' },
		{ key: 'email', header: 'Email' },
		{ key: 'subject', header: 'Sujet' },
		{ key: 'message', header: 'Message' },
		{ key: 'createdAt', header: 'Reçu le' }
	]
} as const satisfies Record<ExportKind, { key: string; header: string }[]>;

async function buildSalesCsv(): Promise<string> {
	const transactions = await prisma.transaction.findMany({
		select: {
			id: true,
			invoiceNumber: true,
			createdAt: true,
			status: true,
			amount: true,
			currency: true,
			customer_details_name: true,
			customer_details_email: true,
			shippingOption: true,
			shippingCost: true,
			trackingNumber: true
		},
		orderBy: { createdAt: 'desc' },
		take: EXPORT_MAX_ROWS
	});

	return toCsv(transactions, EXPORT_COLUMNS.sales);
}

async function buildUsersCsv(): Promise<string> {
	const users = await prisma.user.findMany({
		select: {
			id: true,
			email: true,
			username: true,
			name: true,
			role: true,
			emailVerified: true,
			isMfaEnabled: true,
			createdAt: true
		},
		orderBy: { createdAt: 'desc' },
		take: EXPORT_MAX_ROWS
	});

	return toCsv(users, EXPORT_COLUMNS.users);
}

async function buildProductsCsv(): Promise<string> {
	const products = await prisma.product.findMany({
		select: {
			id: true,
			name: true,
			slug: true,
			price: true,
			stock: true,
			description: true,
			createdAt: true,
			categories: { select: { category: { select: { name: true } } } }
		},
		orderBy: { createdAt: 'desc' },
		take: EXPORT_MAX_ROWS
	});

	const rows = products.map((product) => ({
		...product,
		categories: product.categories.map((c) => c.category.name).join('; ')
	}));

	return toCsv(rows, EXPORT_COLUMNS.products);
}

async function buildBlogCsv(): Promise<string> {
	const posts = await prisma.blogPost.findMany({
		select: {
			id: true,
			title: true,
			slug: true,
			published: true,
			createdAt: true,
			author: { select: { name: true } },
			category: { select: { name: true } }
		},
		orderBy: { createdAt: 'desc' },
		take: EXPORT_MAX_ROWS
	});

	const rows = posts.map((post) => ({
		...post,
		author: post.author?.name ?? '',
		category: post.category?.name ?? ''
	}));

	return toCsv(rows, EXPORT_COLUMNS.blog);
}

async function buildPromoCsv(): Promise<string> {
	const promoCodes = await prisma.promoCode.findMany({
		select: {
			id: true,
			code: true,
			type: true,
			value: true,
			minAmount: true,
			usageLimit: true,
			usageCount: true,
			active: true,
			expiresAt: true,
			createdAt: true
		},
		orderBy: { createdAt: 'desc' },
		take: EXPORT_MAX_ROWS
	});

	return toCsv(promoCodes, EXPORT_COLUMNS.promo);
}

async function buildContactsCsv(): Promise<string> {
	const submissions = await prisma.contactSubmission.findMany({
		select: {
			id: true,
			name: true,
			email: true,
			subject: true,
			message: true,
			createdAt: true
		},
		orderBy: { createdAt: 'desc' },
		take: EXPORT_MAX_ROWS
	});

	return toCsv(submissions, EXPORT_COLUMNS.contacts);
}

const BUILDERS: Record<ExportKind, () => Promise<string>> = {
	sales: buildSalesCsv,
	users: buildUsersCsv,
	products: buildProductsCsv,
	blog: buildBlogCsv,
	promo: buildPromoCsv,
	contacts: buildContactsCsv
};

/** Génère le CSV du jeu de données demandé — lecture directe, pas de fichier
 * intermédiaire ni d'envoi par e-mail : le résultat part directement en
 * réponse HTTP (voir `src/routes/admin/exports/[kind]/+server.ts`). */
export async function buildExportCsv(kind: ExportKind): Promise<string> {
	return BUILDERS[kind]();
}
