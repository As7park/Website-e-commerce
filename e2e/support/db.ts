import { PrismaClient } from '@prisma/client';
import { createDecipheriv } from 'node:crypto';

/**
 * Client Prisma dédié aux tests, branché explicitement sur l'URL de `.env.test`
 * (schéma PostgreSQL `e2e`), afin de ne jamais toucher les données de dev.
 */
export const db = new PrismaClient({
	datasources: { db: { url: process.env.DATABASE_URL } },
	log: ['error']
});

/**
 * Rejoue une lecture sur coupure réseau passagère.
 *
 * La base est distante (Neon) et se met en veille : une requête peut échouer le
 * temps que le calcul redémarre. Sans cela, un incident réseau se lit comme une
 * régression fonctionnelle.
 */
async function resilient<T>(operation: () => Promise<T>, attempts = 4): Promise<T> {
	let lastError: unknown;
	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			return await operation();
		} catch (error) {
			lastError = error;
			const unreachable = String(error).includes("Can't reach database server");
			if (!unreachable) throw error;
			await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
		}
	}
	throw lastError;
}

/**
 * Déchiffre une charge produite par `src/lib/lucia/encryption.ts`. Le module
 * applicatif n'est pas réutilisable ici car il dépend de `$env/static/private`,
 * indisponible hors du bundle SvelteKit — d'où cette réimplémentation.
 *
 * `encryptionVersion` (1 = AES-128-GCM legacy, 2 = AES-256-GCM) doit suivre
 * exactement `$lib/lucia/encryption.ts` : sans ça, un compte encore en v1 (ou
 * migré en v2 après une vérification 2FA réussie) échoue ici avec une taille
 * de clé invalide, alors que l'application le déchiffre très bien.
 */
function decryptPayload(payload: Uint8Array, encryptionVersion: number): Buffer {
	const isLegacy = encryptionVersion === 1;
	const keyEnv = isLegacy ? process.env.ENCRYPTION_KEY_LEGACY : process.env.ENCRYPTION_KEY;
	const algorithm = isLegacy ? 'aes-128-gcm' : 'aes-256-gcm';
	const key = Buffer.from(keyEnv ?? '', 'base64');
	const bytes = Buffer.from(payload);

	const iv = bytes.subarray(0, 16);
	const tag = bytes.subarray(bytes.length - 16);
	const ciphertext = bytes.subarray(16, bytes.length - 16);

	const decipher = createDecipheriv(algorithm, key, iv);
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export async function getUser(email: string) {
	return resilient(() => db.user.findUnique({ where: { email } }));
}

export async function requireUser(email: string) {
	const user = await getUser(email);
	if (!user) throw new Error(`Utilisateur introuvable en base : ${email}`);
	return user;
}

/**
 * Clé TOTP déchiffrée, telle qu'enregistrée après la configuration de la 2FA. */
export async function getTotpKey(email: string): Promise<Uint8Array> {
	const user = await requireUser(email);
	if (!user.totpKey) throw new Error(`Aucune clé TOTP enregistrée pour ${email}`);
	return new Uint8Array(decryptPayload(user.totpKey, user.encryptionVersion));
}

/** Code de récupération en clair, généré à la création du compte. */
export async function getRecoveryCode(email: string): Promise<string> {
	const user = await requireUser(email);
	if (!user.recoveryCode) throw new Error(`Aucun code de récupération pour ${email}`);
	return decryptPayload(Buffer.from(user.recoveryCode, 'base64'), user.encryptionVersion).toString(
		'utf-8'
	);
}

/**
 * Active l'exigence de 2FA. Le commutateur existe côté serveur
 * (`/auth/settings?/isMfaEnabled`) mais son interface est commentée, donc les
 * tests basculent le drapeau en base pour atteindre les parcours 2FA.
 */
export async function enableMfa(email: string) {
	await resilient(() => db.user.update({ where: { email }, data: { isMfaEnabled: true } }));
}

/**
 * Crée un compte minimal qui occupe une adresse email.
 *
 * Sert à vérifier qu'une adresse déjà prise est refusée : seule l'unicité de
 * l'email est en jeu, aucun mot de passe n'est nécessaire.
 */
export async function occupyEmail(email: string) {
	await resilient(() => db.user.create({ data: { email } }));
}

/** Passe un compte au rôle administrateur. Le rôle est relu à chaque requête. */
export async function promoteToAdmin(email: string) {
	await resilient(() => db.user.update({ where: { email }, data: { role: 'ADMIN' } }));
}

/** Code promo jetable (admin, API de validation, checkout). */
export async function createPromoCode(
	code: string,
	overrides?: {
		type?: 'PERCENTAGE' | 'FIXED';
		value?: number;
		minAmount?: number | null;
		usageLimit?: number | null;
		usageCount?: number;
		expiresAt?: Date | null;
		active?: boolean;
		loyaltyThreshold?: number | null;
	}
) {
	return resilient(() =>
		db.promoCode.create({
			data: {
				code,
				type: overrides?.type ?? 'PERCENTAGE',
				value: overrides?.value ?? 10,
				minAmount: overrides?.minAmount ?? null,
				usageLimit: overrides?.usageLimit ?? null,
				usageCount: overrides?.usageCount ?? 0,
				expiresAt: overrides?.expiresAt ?? null,
				active: overrides?.active ?? true,
				loyaltyThreshold: overrides?.loyaltyThreshold ?? null
			}
		})
	);
}

export async function deletePromoCode(id: string) {
	await resilient(async () => {
		await db.promoCode.deleteMany({ where: { id } });
	});
}

/** Nettoie un code généré par un job (ex. relance panier), pas connu à l'avance. */
export async function deletePromoCodeByCode(code: string) {
	await resilient(() => db.promoCode.deleteMany({ where: { code } }));
}

/** Carte cadeau de test — code fourni explicitement (généré côté app en usage réel). */
export async function createGiftCard(
	code: string,
	overrides?: {
		initialValue?: number;
		balance?: number;
		active?: boolean;
		expiresAt?: Date | null;
		recipientEmail?: string | null;
	}
) {
	const initialValue = overrides?.initialValue ?? 50;
	return resilient(() =>
		db.giftCard.create({
			data: {
				code,
				initialValue,
				balance: overrides?.balance ?? initialValue,
				active: overrides?.active ?? true,
				expiresAt: overrides?.expiresAt ?? null,
				recipientEmail: overrides?.recipientEmail ?? null
			}
		})
	);
}

export async function getGiftCardById(id: string) {
	return resilient(() => db.giftCard.findUnique({ where: { id } }));
}

export async function deleteGiftCard(id: string) {
	await resilient(async () => {
		await db.giftCard.deleteMany({ where: { id } });
	});
}

export async function createProductQuestion(
	productId: string,
	userId: string,
	overrides?: { question?: string; answer?: string | null; answeredAt?: Date | null }
) {
	return resilient(() =>
		db.productQuestion.create({
			data: {
				productId,
				userId,
				question: overrides?.question ?? 'Cette pièce est-elle disponible en 52 ?',
				answer: overrides?.answer ?? null,
				answeredAt: overrides?.answeredAt ?? null
			}
		})
	);
}

export async function getProductQuestionById(id: string) {
	return resilient(() => db.productQuestion.findUnique({ where: { id } }));
}

export async function deleteProductQuestion(id: string) {
	await resilient(async () => {
		await db.productQuestion.deleteMany({ where: { id } });
	});
}

export async function createProductVariant(
	productId: string,
	overrides?: { label?: string; sku?: string | null; price?: number | null; stock?: number }
) {
	return resilient(() =>
		db.productVariant.create({
			data: {
				productId,
				label: overrides?.label ?? 'Taille 54',
				sku: overrides?.sku ?? null,
				price: overrides?.price ?? null,
				stock: overrides?.stock ?? 3
			}
		})
	);
}

export async function getProductVariantById(id: string) {
	return resilient(() => db.productVariant.findUnique({ where: { id } }));
}

export async function deleteProductVariant(id: string) {
	await resilient(async () => {
		await db.orderItem.updateMany({ where: { variantId: id }, data: { variantId: null } });
		await db.productVariant.deleteMany({ where: { id } });
	});
}

/** CONTACT-PLUGIN : message de test isolé. */
export async function createContactMessage(overrides?: {
	name?: string;
	email?: string;
	subject?: string;
	message?: string;
}) {
	const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	return resilient(() =>
		db.contactSubmission.create({
			data: {
				name: overrides?.name ?? `e2e-contact-${stamp}`,
				email: overrides?.email ?? `e2e-contact-${stamp}@example.test`,
				subject: overrides?.subject ?? `Sujet e2e ${stamp}`,
				message: overrides?.message ?? `Message de test e2e ${stamp}.`
			}
		})
	);
}

export async function deleteContactMessage(id: string) {
	await resilient(async () => {
		await db.contactSubmission.deleteMany({ where: { id } });
	});
}

export async function deleteContactMessagesByEmail(email: string) {
	await resilient(async () => {
		await db.contactSubmission.deleteMany({ where: { email } });
	});
}

export async function countContactMessagesByEmail(email: string) {
	return resilient(() => db.contactSubmission.count({ where: { email } }));
}

export async function findPromoCode(id: string) {
	return resilient(() => db.promoCode.findUnique({ where: { id } }));
}

/**
 * Taxonomie « Catégorie » partagée par les tests de catalogue — jamais
 * supprimée (seules les valeurs jetables `e2e-cat-*` qu'elle porte le sont).
 * `upsert` sur le slug évite toute collision entre workers Playwright.
 */
async function ensureCatalogTaxonomy() {
	return resilient(() =>
		db.taxonomy.upsert({
			where: { slug: 'e2e-categorie' },
			update: {},
			create: { name: 'E2E Catégorie', slug: 'e2e-categorie', type: 'TEXT', multiple: true }
		})
	);
}

/** Catalogue : produit de test isolé (image factice, pas d'upload Cloudinary). */
export async function createCatalogProduct(overrides?: { name?: string; slug?: string }) {
	const stamp = `${Date.now()}`;
	const category = await createCatalogCategory();
	const product = await resilient(() =>
		db.product.create({
			data: {
				name: overrides?.name ?? `e2e-prod-${stamp}`,
				slug: overrides?.slug ?? `e2e-prod-${stamp}`,
				description: 'Produit de test e2e pour le catalogue.',
				price: 12.5,
				stock: 10,
				images: ['https://example.test/e2e-product.jpg'],
				colorProduct: '#112233',
				taxonomyValues: { create: { taxonomyValueId: category.id } }
			}
		})
	);
	return { product, category };
}

/**
 * Produit de test avec un `createdAt` volontairement ancien, pour les tests
 * de purge (`/admin/exports`). Le décalage doit rester net (plusieurs mois)
 * pour ne jamais recouper un produit fraîchement créé par un autre test.
 */
export async function createOldCatalogProduct(daysAgo: number, overrides?: { name?: string }) {
	const stamp = `${Date.now()}`;
	const category = await createCatalogCategory();
	const product = await resilient(() =>
		db.product.create({
			data: {
				name: overrides?.name ?? `e2e-prod-old-${stamp}`,
				slug: overrides?.name ?? `e2e-prod-old-${stamp}`,
				description: 'Produit de test e2e pour la purge.',
				price: 12.5,
				stock: 10,
				images: ['https://example.test/e2e-product.jpg'],
				colorProduct: '#112233',
				createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
				taxonomyValues: { create: { taxonomyValueId: category.id } }
			}
		})
	);
	return { product, category };
}

export async function getProductBySlug(slug: string) {
	return resilient(() => db.product.findUnique({ where: { slug } }));
}

export async function getProductById(id: string) {
	return resilient(() =>
		db.product.findUnique({
			where: { id },
			include: { taxonomyValues: { include: { taxonomyValue: true } } }
		})
	);
}

export async function getProductByName(name: string) {
	return resilient(() => db.product.findFirst({ where: { name } }));
}

/** Blog : article de test isolé (auteur + catégorie dédiés). */
export async function createBlogPost(overrides?: {
	title?: string;
	slug?: string;
	published?: boolean;
}) {
	const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	const author = await resilient(() =>
		db.blogAuthor.create({ data: { name: `e2e-blog-author-${stamp}` } })
	);
	const category = await resilient(() =>
		db.blogCategory.create({
			data: { name: `e2e-blog-cat-${stamp}`, description: 'Catégorie de test e2e.' }
		})
	);
	const post = await resilient(() =>
		db.blogPost.create({
			data: {
				title: overrides?.title ?? `e2e-post-${stamp}`,
				slug: overrides?.slug ?? `e2e-post-${stamp}`,
				content: '<p>Contenu de test e2e pour le blog.</p>',
				published: overrides?.published ?? true,
				authorId: author.id,
				categoryId: category.id
			}
		})
	);
	return { post, author, category };
}

export async function getBlogPostBySlug(slug: string) {
	return resilient(() => db.blogPost.findUnique({ where: { slug } }));
}

export async function getBlogPostById(id: string) {
	return resilient(() => db.blogPost.findUnique({ where: { id } }));
}

export async function setBlogPostPublished(id: string, published: boolean) {
	return resilient(() => db.blogPost.update({ where: { id }, data: { published } }));
}

export async function updateBlogPostTitle(id: string, title: string) {
	return resilient(() => db.blogPost.update({ where: { id }, data: { title } }));
}

export async function deleteBlogPost(postId: string) {
	const post = await resilient(() =>
		db.blogPost.findUnique({
			where: { id: postId }
		})
	);
	if (!post) return;

	await resilient(() => db.blogPostTag.deleteMany({ where: { postId } }));
	await resilient(() => db.blogComment.deleteMany({ where: { postId } }));
	await resilient(() => db.blogPost.deleteMany({ where: { id: postId } }));

	const remainingForAuthor = await resilient(() =>
		db.blogPost.count({ where: { authorId: post.authorId } })
	);
	if (remainingForAuthor === 0) {
		await resilient(() =>
			db.blogAuthor.deleteMany({
				where: { id: post.authorId, name: { startsWith: 'e2e-blog-author-' } }
			})
		);
	}

	if (post.categoryId) {
		const remainingForCategory = await resilient(() =>
			db.blogPost.count({ where: { categoryId: post.categoryId } })
		);
		if (remainingForCategory === 0) {
			await resilient(() =>
				db.blogCategory.deleteMany({
					where: { id: post.categoryId, name: { startsWith: 'e2e-blog-cat-' } }
				})
			);
		}
	}
}

/** Relie un produit à une commande, pour vérifier le refus de suppression. */
export async function linkProductToOrder(
	userId: string,
	productId: string,
	overrides?: { variantId?: string }
) {
	const order = await resilient(() => db.order.create({ data: { userId } }));
	const item = await resilient(() =>
		db.orderItem.create({
			data: { orderId: order.id, productId, variantId: overrides?.variantId, quantity: 1, price: 1 }
		})
	);
	return { order, item };
}

/**
 * Recule `Order.updatedAt` de `hoursAgo` heures — nécessaire pour simuler un
 * panier abandonné sans attendre réellement 1h/24h. `@updatedAt` est
 * réécrit par le moteur Prisma sur tout `update()` classique (la valeur
 * fournie est ignorée), d'où le passage par `$executeRaw`. Table
 * explicitement qualifiée `"e2e"."orders"` : contrairement aux requêtes
 * générées par le client Prisma, le SQL brut ne suit pas le paramètre
 * `schema=e2e` de `DATABASE_URL` (pas de `search_path` positionné côté
 * session) — sans ce préfixe, la commande s'exécute silencieusement dans
 * `public` et ne trouve jamais la ligne (0 ligne affectée, aucune erreur).
 */
export async function backdateOrder(orderId: string, hoursAgo: number) {
	await resilient(
		() =>
			db.$executeRaw`UPDATE "e2e"."orders" SET "updatedAt" = NOW() - (${hoursAgo}::float * interval '1 hour') WHERE id = ${orderId}`
	);
}

/** Relance panier abandonné : horodatages d'envoi, pour les assertions. */
export async function getOrderReminderState(orderId: string) {
	return resilient(() =>
		db.order.findUniqueOrThrow({
			where: { id: orderId },
			select: { cartReminder1SentAt: true, cartReminder2SentAt: true }
		})
	);
}

export async function deleteCatalogProduct(productId: string) {
	const product = await resilient(() =>
		db.product.findUnique({
			where: { id: productId },
			include: { taxonomyValues: true }
		})
	);
	if (!product) return;

	await resilient(() => db.orderItem.deleteMany({ where: { productId } }));
	await resilient(() => db.productTaxonomyValue.deleteMany({ where: { productId } }));
	await resilient(() => db.product.deleteMany({ where: { id: productId } }));

	for (const link of product.taxonomyValues) {
		const remaining = await resilient(() =>
			db.productTaxonomyValue.count({ where: { taxonomyValueId: link.taxonomyValueId } })
		);
		if (remaining === 0) {
			await resilient(() =>
				db.taxonomyValue.deleteMany({
					where: { id: link.taxonomyValueId, value: { startsWith: 'e2e-cat-' } }
				})
			);
		}
	}
}

/** Nombre de sessions actives, pour vérifier révocations et déconnexions. */
export async function countSessions(email: string): Promise<number> {
	const user = await requireUser(email);
	return resilient(() => db.session.count({ where: { userId: user.id } }));
}

/**
 * Nettoyage en fin de test.
 *
 * Les commandes doivent partir en premier : l'application crée un panier
 * (commande au statut PENDING) dès qu'un utilisateur authentifié charge une
 * page, et la relation `Order → User` est en `Restrict`. Le reste (sessions,
 * demandes de vérification, sessions de réinitialisation) part en cascade.
 */
export async function getPendingOrder(userId: string) {
	return resilient(() =>
		db.order.findFirst({
			where: { userId, status: 'PENDING' },
			include: { items: true }
		})
	);
}

export async function getOrderById(orderId: string) {
	return resilient(() =>
		db.order.findUnique({
			where: { id: orderId },
			include: { items: true }
		})
	);
}

export async function attachOrderAddress(orderId: string, addressId: string) {
	return resilient(() =>
		db.order.update({
			where: { id: orderId },
			data: {
				shippingAddressId: addressId,
				billingAddressId: addressId,
				shippingOption: 'no_shipping',
				shippingCost: 0
			}
		})
	);
}

export async function getTransactionByStripePaymentId(stripePaymentId: string) {
	return resilient(() =>
		db.transaction.findUnique({
			where: { stripePaymentId }
		})
	);
}

export async function findAddressesByUserId(userId: string) {
	return resilient(() => db.address.findMany({ where: { userId } }));
}

export async function findAddressById(id: string) {
	return resilient(() => db.address.findUnique({ where: { id } }));
}

/**
 * Valeur jetable de la taxonomie « Catégorie » de test — remplace l'ancienne
 * `Category` legacy. Le nom (`.name`) est conservé pour ne pas faire bouger
 * les specs qui l'utilisent comme libellé affiché dans l'UI.
 */
export async function createCatalogCategory() {
	const taxonomy = await ensureCatalogTaxonomy();
	const name = `e2e-cat-${Date.now()}`;
	const value = await resilient(() =>
		db.taxonomyValue.create({ data: { taxonomyId: taxonomy.id, value: name, label: name } })
	);
	return { id: value.id, name: value.value };
}

export async function deleteCatalogCategory(id: string) {
	await resilient(() =>
		db.taxonomyValue.deleteMany({ where: { id, value: { startsWith: 'e2e-cat-' } } })
	);
}

/**
 * `Category`/`ProductCategory` legacy — non retirés tant que la migration B
 * n'est pas passée, seul consommateur restant : `getRelatedProducts` (ventes
 * croisées). Sans rapport avec `createCatalogCategory` ci-dessus (taxonomie).
 */
export async function createLegacyCategory(name?: string) {
	return resilient(() =>
		db.category.create({ data: { name: name ?? `e2e-legacy-cat-${Date.now()}` } })
	);
}

export async function linkProductToLegacyCategory(productId: string, categoryId: string) {
	return resilient(() => db.productCategory.create({ data: { productId, categoryId } }));
}

/** Supprime la catégorie legacy : cascade sur ses `ProductCategory`. */
export async function deleteLegacyCategory(id: string) {
	await resilient(() => db.category.deleteMany({ where: { id } }));
}

export async function createUserAddress(userId: string) {
	return resilient(() =>
		db.address.create({
			data: {
				userId,
				first_name: 'E2e',
				last_name: 'Tester',
				phone: '+33600000000',
				street_number: '1',
				street: 'Rue des Tests',
				city: 'Toulouse',
				county: 'Haute-Garonne',
				state: 'Occitanie',
				stateLetter: 'FR',
				state_code: 'OC',
				zip: '31000',
				country: 'France',
				country_code: 'FR',
				ISO_3166_1_alpha_3: 'FRA'
			}
		})
	);
}

/** Paiement simulé : Transaction + Order PAID, sans Stripe. */
export async function simulatePaidOrder(orderId: string, userId: string, email: string) {
	const stamp = `${Date.now()}`;
	const transaction = await resilient(() =>
		db.transaction.create({
			data: {
				stripePaymentId: `e2e-stripe-${stamp}`,
				orderId,
				userId,
				amount: 12.5,
				currency: 'eur',
				customer_details_email: email,
				customer_details_name: 'E2e Tester',
				status: 'paid',
				shippingOption: 'no_shipping',
				shippingCost: 0,
				shippingMethodId: 0,
				shippingMethodName: 'e2e',
				package_length: 10,
				package_width: 10,
				package_height: 10,
				package_dimension_unit: 'cm',
				package_weight: 1,
				package_weight_unit: 'kg',
				package_volume: 1000,
				package_volume_unit: 'cm3',
				address_first_name: 'E2e',
				address_last_name: 'Tester',
				address_phone: '+33600000000',
				address_street_number: '1',
				address_street: 'Rue des Tests',
				address_city: 'Toulouse',
				address_county: 'Haute-Garonne',
				address_state: 'Occitanie',
				address_stateLetter: 'FR',
				address_state_code: 'OC',
				address_zip: '31000',
				address_country: 'France',
				address_country_code: 'FR',
				address_ISO_3166_1_alpha_3: 'FRA',
				billing_first_name: 'E2e',
				billing_last_name: 'Tester',
				billing_phone: '+33600000000',
				billing_street_number: '1',
				billing_street: 'Rue des Tests',
				billing_city: 'Toulouse',
				billing_county: 'Haute-Garonne',
				billing_state: 'Occitanie',
				billing_stateLetter: 'FR',
				billing_state_code: 'OC',
				billing_zip: '31000',
				billing_country: 'France',
				billing_country_code: 'FR',
				billing_ISO_3166_1_alpha_3: 'FRA',
				products: []
			}
		})
	);
	await resilient(() => db.order.update({ where: { id: orderId }, data: { status: 'PAID' } }));
	return transaction;
}

export async function getTransactionById(id: string) {
	return resilient(() => db.transaction.findUnique({ where: { id } }));
}

export async function deleteTransaction(id: string) {
	await resilient(() => db.transaction.deleteMany({ where: { id } }));
}

/**
 * Nettoyage en fin de test.
 *
 * Les commandes doivent partir en premier : l'application crée un panier
 * (commande au statut PENDING) dès qu'un utilisateur authentifié charge une
 * page, et la relation `Order → User` est en `Restrict`. Le reste (sessions,
 * demandes de vérification, sessions de réinitialisation) part en cascade.
 */
export async function deleteUser(email: string) {
	const user = await getUser(email);
	if (!user) return;

	await resilient(() => db.transaction.deleteMany({ where: { userId: user.id } }));
	await resilient(() => db.order.deleteMany({ where: { userId: user.id } }));
	await resilient(() => db.user.delete({ where: { id: user.id } }));
}

/** Taxonomie de test isolée (CRUD admin générique — remplace l'ancienne "Matière"). */
export async function createTaxonomy(overrides?: {
	name?: string;
	slug?: string;
	multiple?: boolean;
}) {
	const stamp = `${Date.now()}`;
	return resilient(() =>
		db.taxonomy.create({
			data: {
				name: overrides?.name ?? `e2e-taxonomy-${stamp}`,
				slug: overrides?.slug ?? `e2e-taxonomy-${stamp}`,
				type: 'TEXT',
				multiple: overrides?.multiple ?? false
			}
		})
	);
}

export async function getTaxonomyById(id: string) {
	return resilient(() => db.taxonomy.findUnique({ where: { id } }));
}

export async function getTaxonomyByName(name: string) {
	return resilient(() => db.taxonomy.findFirst({ where: { name } }));
}

/** Cascade DB (`onDelete: Cascade`) : supprime aussi ses valeurs et les liaisons produit. */
export async function deleteTaxonomy(id: string) {
	await resilient(() => db.taxonomy.deleteMany({ where: { id } }));
}

export async function createTaxonomyValue(taxonomyId: string, overrides?: { value?: string }) {
	return resilient(() =>
		db.taxonomyValue.create({
			data: { taxonomyId, value: overrides?.value ?? `e2e-value-${Date.now()}` }
		})
	);
}

export async function getTaxonomyValueById(id: string) {
	return resilient(() => db.taxonomyValue.findUnique({ where: { id } }));
}

/** Avis produit : pose un avis directement en base (sans passer par la fiche produit). */
export async function createReview(overrides: {
	productId: string;
	userId: string;
	rating?: number;
	comment?: string | null;
}) {
	return resilient(() =>
		db.review.create({
			data: {
				productId: overrides.productId,
				userId: overrides.userId,
				rating: overrides.rating ?? 5,
				comment: overrides.comment ?? null
			}
		})
	);
}

export async function getReviewForUser(productId: string, userId: string) {
	return resilient(() =>
		db.review.findUnique({ where: { productId_userId: { productId, userId } } })
	);
}

/** Liste d'envies : bascule directe en base (sans passer par la fiche produit). */
export async function isInWishlistDb(userId: string, productId: string): Promise<boolean> {
	const item = await resilient(() =>
		db.wishlistItem.findUnique({ where: { userId_productId: { userId, productId } } })
	);
	return item !== null;
}

/**
 * Réglages boutique (`StoreSettings`, ligne unique `id = "singleton"`).
 *
 * Ligne partagée par toute la suite : chaque test qui modifie un module doit
 * restaurer les valeurs lues par `getStoreFeatureFlags` (`finally` avec
 * `setStoreFeatureFlags(previous)`), pour ne pas laisser un module activé/
 * désactivé pour les tests suivants.
 */
export async function getStoreFeatureFlags() {
	const row = await resilient(() =>
		db.storeSettings.findUniqueOrThrow({
			where: { id: 'singleton' },
			select: {
				wishlistEnabled: true,
				crossSellEnabled: true,
				returnsEnabled: true,
				savedPaymentsEnabled: true,
				loyaltyEnabled: true,
				giftCardsEnabled: true,
				productQnaEnabled: true,
				cartRecoveryEnabled: true
			}
		})
	);
	return row;
}

export async function setStoreFeatureFlags(patch: {
	wishlistEnabled?: boolean;
	crossSellEnabled?: boolean;
	returnsEnabled?: boolean;
	savedPaymentsEnabled?: boolean;
	loyaltyEnabled?: boolean;
	giftCardsEnabled?: boolean;
	productQnaEnabled?: boolean;
	cartRecoveryEnabled?: boolean;
}) {
	return resilient(() => db.storeSettings.update({ where: { id: 'singleton' }, data: patch }));
}

/** Retours/SAV : lecture par transaction (unique), pour les assertions. */
export async function getReturnRequestByTransactionId(transactionId: string) {
	return resilient(() => db.returnRequest.findUnique({ where: { transactionId } }));
}

/**
 * Moyens de paiement enregistrés : insertion directe, sans passer par
 * l'action `attach` (qui appelle Stripe pour relire la carte) — cette
 * dernière n'est pas rejouable en e2e sans une vraie `PaymentMethod` Stripe.
 */
export async function createSavedPaymentMethod(
	userId: string,
	overrides?: {
		stripePaymentMethodId?: string;
		brand?: string;
		last4?: string;
		expMonth?: number;
		expYear?: number;
		isDefault?: boolean;
	}
) {
	const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	return resilient(() =>
		db.savedPaymentMethod.create({
			data: {
				userId,
				stripePaymentMethodId: overrides?.stripePaymentMethodId ?? `e2e-pm-${stamp}`,
				brand: overrides?.brand ?? 'visa',
				last4: overrides?.last4 ?? '4242',
				expMonth: overrides?.expMonth ?? 12,
				expYear: overrides?.expYear ?? 2099,
				isDefault: overrides?.isDefault ?? false
			}
		})
	);
}

export async function getSavedPaymentMethodsByUserId(userId: string) {
	return resilient(() => db.savedPaymentMethod.findMany({ where: { userId } }));
}

/** Fidélité : attribution éventuelle d'un code à un compte, pour un code donné. */
export async function getLoyaltyAward(userId: string, promoCodeId: string) {
	return resilient(() =>
		db.loyaltyAward.findUnique({ where: { userId_promoCodeId: { userId, promoCodeId } } })
	);
}
