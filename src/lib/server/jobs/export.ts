import { prisma } from '$lib/server';
import cloudinary from '$lib/server/cloudinary';
import { sendMail } from '$lib/server/smtp-mail';
import { log } from '$lib/server/log';
import { toCsv } from '$lib/server/export/csv';

export type ExportKind = 'sales' | 'users';

/** Fenêtre volontairement large pour un export (contrairement au dashboard,
 * borné à 12 mois) : un admin qui exporte veut typiquement l'historique
 * complet. Le plafond ci-dessous reste un filet contre un volume démesuré. */
const EXPORT_MAX_ROWS = 20000;
/** Durée de validité du lien signé Cloudinary envoyé par e-mail. */
const DOWNLOAD_LINK_TTL_SECONDS = 60 * 60 * 24; // 24h

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

	return toCsv(transactions, [
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
	]);
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

	return toCsv(users, [
		{ key: 'id', header: 'ID' },
		{ key: 'email', header: 'Email' },
		{ key: 'username', header: 'Pseudo' },
		{ key: 'name', header: 'Nom' },
		{ key: 'role', header: 'Rôle' },
		{ key: 'emailVerified', header: 'Email vérifié' },
		{ key: 'isMfaEnabled', header: '2FA activée' },
		{ key: 'createdAt', header: 'Créé le' }
	]);
}

/**
 * Génère un export CSV (ventes ou utilisateurs), l'héberge sur Cloudinary en
 * accès `authenticated` (jamais public : le CSV contient des données clients
 * — email, nom — et des montants), puis envoie un lien signé, à expiration,
 * par e-mail à l'admin qui l'a demandé.
 *
 * Volontairement PAS sous verrou (`withLock`) : contrairement aux jobs
 * Sendcloud/facture, deux exports concurrents ne se marchent pas dessus —
 * chacun génère son propre fichier, aucun état partagé à protéger.
 */
export async function runExportJob(kind: ExportKind, requestedByEmail: string): Promise<void> {
	const csv = kind === 'sales' ? await buildSalesCsv() : await buildUsersCsv();
	const publicId = `exports/${kind}-${Date.now()}`;

	await cloudinary.uploader.upload(
		`data:text/csv;base64,${Buffer.from(csv, 'utf-8').toString('base64')}`,
		{
			public_id: publicId,
			resource_type: 'raw',
			type: 'authenticated'
		}
	);

	const expiresAt = Math.floor(Date.now() / 1000) + DOWNLOAD_LINK_TTL_SECONDS;
	const downloadUrl = cloudinary.utils.private_download_url(publicId, 'csv', {
		resource_type: 'raw',
		type: 'authenticated',
		expires_at: expiresAt
	});

	const label = kind === 'sales' ? 'des ventes' : 'des utilisateurs';
	await sendMail({
		to: requestedByEmail,
		subject: `Export ${label} — prêt à télécharger`,
		text: `Votre export ${label} est prêt. Lien de téléchargement (valable 24h) : ${downloadUrl}`,
		html: `<p>Votre export ${label} est prêt.</p><p><a href="${downloadUrl}">Télécharger le CSV</a> (lien valable 24h).</p>`
	});

	log('INFO', 'export', `Export ${kind} terminé et envoyé à ${requestedByEmail}`, { publicId });
}
