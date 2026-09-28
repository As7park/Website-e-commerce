import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { createCipheriv, randomBytes } from 'crypto';
import { decodeBase64 } from '@oslojs/encoding';
import dotenv from 'dotenv';
import { blog } from './seed-data/blog.js'; // BLOG-PLUGIN

dotenv.config();

if (!process.env.ENCRYPTION_KEY) {
	throw new Error('ENCRYPTION_KEY is not defined in the environment variables.');
}

const key = decodeBase64(process.env.ENCRYPTION_KEY);
const prisma = new PrismaClient();

/** Mot de passe commun aux comptes email de démonstration. */
const DEMO_PASSWORD = 'DemoPass!2026';

const ARGON2 = {
	memoryCost: 19456,
	timeCost: 2,
	outputLen: 32,
	parallelism: 1
};

// AES-256-GCM (`encryptionVersion` 2) — même schéma que `$lib/lucia/encryption.ts`.
const encrypt = (data) => {
	const iv = randomBytes(16);
	const cipher = createCipheriv('aes-256-gcm', key, iv);
	const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
	const tag = cipher.getAuthTag();
	return Buffer.concat([iv, ciphertext, tag]);
};

const generateRecoveryCode = () => Math.floor(10000000 + Math.random() * 90000000).toString();

// Parrainage : même alphabet que `generateUniqueReferralCode` côté app, une
// simple collision improbable suffit pour un jeu de données de démo.
const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const generateReferralCode = () => {
	const bytes = randomBytes(8);
	let code = '';
	for (let i = 0; i < 8; i++) {
		code += REFERRAL_CODE_ALPHABET[bytes[i] % REFERRAL_CODE_ALPHABET.length];
	}
	return code;
};

const money = (value) => parseFloat(Number(value).toFixed(2));

const vatFromTtc = (ttc) => {
	const total = money(ttc);
	const subtotal = money(total / 1.2);
	return { subtotal, tax: money(total - subtotal), total };
};

const atUtc = (year, monthIndex, day, hour = 10) =>
	new Date(Date.UTC(year, monthIndex, day, hour, 15, 0));

const ADMIN_EMAIL = 'admin@as7park.com'; // ADMIN-PLUGIN : compte de démonstration

// PRODUCT-PLUGIN : taxonomies de démonstration (système générique, remplace Material/Category).
// « Discipline » reste mono-valeur (multiple: false), « Catégorie » multi-valeur (multiple: true) —
// mêmes règles métier qu'avant la généralisation.
const TAXONOMIES = [
	{
		name: 'Discipline',
		slug: 'discipline',
		type: 'TEXT',
		multiple: false,
		values: ['Cross / Enduro', 'Route']
	},
	{
		name: 'Catégorie',
		slug: 'categorie',
		type: 'TEXT',
		multiple: true,
		values: ['Équipement pilote', 'Pièces', 'Accessoires', 'Entretien']
	}
];

const PRODUCTS = [
	{
		name: 'Casque cross AS7 Carbon',
		slug: 'casque-cross-carbon',
		colorProduct: '#ffb200',
		category: 'Équipement pilote',
		discipline: 'Cross / Enduro',
		price: 389,
		stock: 14,
		weight: 1.6,
		length: 40,
		width: 32,
		height: 30,
		image:
			'https://images.unsplash.com/photo-1558980664-10e7170b5df9?auto=format&fit=crop&w=800&q=80',
		description:
			'Casque cross en fibre de carbone, homologué ECE 22.06. Ventilation optimisée, mousses amovibles et lavables, visière réglable.'
	},
	{
		name: 'Gants cross Grip',
		slug: 'gants-cross-grip',
		colorProduct: '#14120f',
		category: 'Équipement pilote',
		discipline: 'Cross / Enduro',
		price: 34.9,
		stock: 60,
		weight: 0.2,
		length: 25,
		width: 15,
		height: 4,
		image:
			'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80',
		description:
			'Gants légers et respirants, paume renforcée anti-ampoules et bouts de doigts compatibles écran tactile.'
	},
	{
		name: 'Kit transmission 520',
		slug: 'kit-transmission-520',
		colorProduct: '#8a6f52',
		category: 'Pièces',
		discipline: 'Cross / Enduro',
		price: 149,
		stock: 18,
		weight: 3.2,
		length: 40,
		width: 30,
		height: 10,
		image:
			'https://images.unsplash.com/photo-1591637333184-19aa84b3e01f?auto=format&fit=crop&w=800&q=80',
		description:
			'Kit chaîne à joints toriques, pignon acier et couronne aluminium au pas de 520. Vérifiez la compatibilité avec votre modèle avant commande.'
	},
	{
		name: 'Lunettes cross Vision',
		slug: 'lunettes-cross-vision',
		colorProduct: '#c9f04d',
		category: 'Équipement pilote',
		discipline: 'Cross / Enduro',
		price: 59.9,
		stock: 35,
		weight: 0.3,
		length: 25,
		width: 15,
		height: 10,
		image:
			'https://images.unsplash.com/photo-1449426468159-d96dbf08f19f?auto=format&fit=crop&w=800&q=80',
		description:
			'Masque cross à écran anti-buée et anti-rayures, mousse triple densité et sangle siliconée pour un maintien parfait sur le casque.'
	},
	{
		name: 'Huile moteur 4T 10W40 — 4 L',
		slug: 'huile-moteur-4t-10w40',
		colorProduct: '#7a2e12',
		category: 'Entretien',
		discipline: null,
		price: 44.9,
		stock: 80,
		weight: 3.8,
		length: 25,
		width: 15,
		height: 30,
		image:
			'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80',
		description:
			'Huile semi-synthèse pour moteurs 4 temps, norme JASO MA2 compatible embrayage à bain d’huile. Bidon de 4 litres.'
	},
	{
		name: 'Lève-moto d’atelier',
		slug: 'leve-moto-atelier',
		colorProduct: '#f2efe4',
		category: 'Accessoires',
		discipline: 'Route',
		price: 89,
		stock: 10,
		weight: 5.5,
		length: 45,
		width: 35,
		height: 15,
		image:
			'https://images.unsplash.com/photo-1622185135505-2d795003994a?auto=format&fit=crop&w=800&q=80',
		description:
			'Béquille d’atelier en acier avec supports caoutchouc, pour lever la roue arrière en toute sécurité lors de l’entretien.'
	}
];

const PARIS = {
	city: 'Paris',
	county: 'Paris',
	state: 'Île-de-France',
	stateLetter: 'IDF',
	state_code: 'IDF',
	zip: '75011',
	country: 'France',
	country_code: 'FR',
	ISO_3166_1_alpha_3: 'FRA'
};

const LYON = {
	city: 'Lyon',
	county: 'Rhône',
	state: 'Auvergne-Rhône-Alpes',
	stateLetter: 'ARA',
	state_code: 'ARA',
	zip: '69002',
	country: 'France',
	country_code: 'FR',
	ISO_3166_1_alpha_3: 'FRA'
};

const RELAY = {
	shippingOption: 'mondialrelay/point-relais',
	shippingCost: 4.9,
	shippingMethodId: 8,
	shippingMethodName: 'Mondial Relay — Point relais',
	servicePointId: 'FR-75011-00123',
	servicePointPostNumber: '12345',
	servicePointLatitude: '48.865',
	servicePointLongitude: '2.378',
	servicePointType: 'service_point',
	servicePointExtraRefCab: 'MID-CAB-001',
	servicePointExtraShopRef: 'SHOP-11-BERANGER'
};

const PACKAGE = {
	package_length: 32,
	package_width: 24,
	package_height: 8,
	package_dimension_unit: 'cm',
	package_weight: 1.2,
	package_weight_unit: 'kg',
	package_volume: 6144,
	package_volume_unit: 'cm3'
};

/**
 * Vide toutes les tables. L'ordre suit les dépendances de clés étrangères :
 * les cascades ne couvrent pas les relations en Restrict (orders → users,
 * order_items → products, blog_posts → blog_authors).
 */
async function truncate() {
	await prisma.$transaction([
		prisma.blogPostTaxonomyValue.deleteMany(), // BLOG-PLUGIN
		prisma.blogPostTag.deleteMany(), // BLOG-PLUGIN
		prisma.blogComment.deleteMany(), // BLOG-PLUGIN
		prisma.blogPost.deleteMany(), // BLOG-PLUGIN
		prisma.blogTaxonomyValue.deleteMany(), // BLOG-PLUGIN
		prisma.blogTaxonomy.deleteMany(), // BLOG-PLUGIN
		prisma.blogCategory.deleteMany(), // BLOG-PLUGIN
		prisma.blogAuthor.deleteMany(), // BLOG-PLUGIN
		prisma.blogTag.deleteMany(), // BLOG-PLUGIN
		prisma.custom.deleteMany(),
		prisma.orderStatusHistory.deleteMany(),
		prisma.orderItem.deleteMany(),
		prisma.transaction.deleteMany(), // COMMERCE-PLUGIN
		prisma.order.deleteMany(), // COMMERCE-PLUGIN
		prisma.address.deleteMany(),
		prisma.wishlistItem.deleteMany(), // PRODUCT-PLUGIN
		prisma.review.deleteMany(), // PRODUCT-PLUGIN
		prisma.productCategory.deleteMany(),
		prisma.productTaxonomyValue.deleteMany(), // PRODUCT-PLUGIN
		prisma.product.deleteMany(),
		prisma.category.deleteMany(),
		prisma.material.deleteMany(), // PRODUCT-PLUGIN
		prisma.taxonomyValue.deleteMany(), // PRODUCT-PLUGIN
		prisma.taxonomy.deleteMany(), // PRODUCT-PLUGIN
		prisma.promoCode.deleteMany(), // PROMO-PLUGIN
		prisma.contactSubmission.deleteMany(), // CONTACT-PLUGIN
		prisma.adminAuditLog.deleteMany(), // ADMIN-PLUGIN
		prisma.storeSettings.deleteMany(), // ADMIN-PLUGIN
		prisma.session.deleteMany(),
		prisma.emailVerificationRequest.deleteMany(),
		prisma.passwordResetSession.deleteMany(),
		prisma.user.deleteMany()
	]);
}

async function createDemoUser({
	email,
	username,
	name,
	role,
	emailVerified,
	isMfaEnabled,
	googleId,
	picture,
	createdAt,
	passwordHash
}) {
	const recoveryCode = generateRecoveryCode();
	return prisma.user.create({
		data: {
			email,
			username,
			name,
			role,
			emailVerified,
			isMfaEnabled: Boolean(isMfaEnabled),
			googleId: googleId ?? null,
			picture: picture ?? null,
			passwordHash: googleId ? null : passwordHash,
			totpKey: Buffer.from(encrypt(randomBytes(32))),
			recoveryCode: encrypt(Buffer.from(recoveryCode, 'utf-8')).toString('base64'),
			encryptionVersion: 2,
			referralCode: generateReferralCode(),
			createdAt
		}
	});
}

function snapshotProducts(items) {
	return items.map((item) => ({
		id: item.productId,
		name: item.product.name,
		price: item.price,
		quantity: item.quantity,
		description: item.product.description,
		stock: item.product.stock,
		images: item.product.images,
		customizations: (item.custom ?? []).map((entry) => ({
			id: entry.id,
			image: entry.image,
			userMessage: entry.userMessage,
			createdAt: entry.createdAt,
			updatedAt: entry.updatedAt
		}))
	}));
}

async function createPaidFlow({
	user,
	address,
	status,
	createdAt,
	history,
	lines,
	shipping = RELAY,
	promoCode = null,
	discountAmount = 0,
	stripePaymentId,
	transactionStatus = 'paid',
	custom = null,
	tracking = null
}) {
	const merchandise = money(
		lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0)
	);
	const shippingCost = money(shipping.shippingCost ?? 0);
	const totals = vatFromTtc(merchandise - discountAmount + shippingCost);

	const order = await prisma.order.create({
		data: {
			userId: user.id,
			shippingAddressId: address.id,
			billingAddressId: address.id,
			status,
			promoCode,
			discountAmount,
			subtotal: totals.subtotal,
			tax: totals.tax,
			total: totals.total,
			shippingOption: shipping.shippingOption,
			shippingCost,
			servicePointId: shipping.servicePointId ?? null,
			servicePointPostNumber: shipping.servicePointPostNumber ?? null,
			servicePointLatitude: shipping.servicePointLatitude ?? null,
			servicePointLongitude: shipping.servicePointLongitude ?? null,
			servicePointType: shipping.servicePointType ?? null,
			servicePointExtraRefCab: shipping.servicePointExtraRefCab ?? null,
			servicePointExtraShopRef: shipping.servicePointExtraShopRef ?? null,
			createdAt,
			updatedAt: createdAt,
			items: {
				create: lines.map((line) => ({
					productId: line.product.id,
					quantity: line.quantity,
					price: line.product.price,
					createdAt,
					updatedAt: createdAt,
					...(custom
						? {
								custom: {
									create: {
										image: custom.image,
										userMessage: custom.userMessage,
										createdAt,
										updatedAt: createdAt
									}
								}
							}
						: {})
				}))
			},
			statusHistory: {
				create: history.map((entry) => ({
					status: entry.status,
					changedAt: entry.changedAt
				}))
			}
		},
		include: {
			items: { include: { product: true, custom: true } }
		}
	});

	const needsTransaction = status === 'PAID' || status === 'SHIPPED';
	if (!needsTransaction) {
		return order;
	}

	await prisma.transaction.create({
		data: {
			stripePaymentId,
			orderId: order.id,
			userId: user.id,
			amount: totals.total,
			currency: 'eur',
			customer_details_email: user.email,
			customer_details_name: user.name,
			customer_details_phone: address.phone,
			status: transactionStatus,
			createdAt,
			updatedAt: createdAt,
			shippingOption: shipping.shippingOption,
			shippingCost,
			shippingMethodId: shipping.shippingMethodId ?? 0,
			shippingMethodName: shipping.shippingMethodName ?? shipping.shippingOption,
			sendcloudParcelId: tracking?.sendcloudParcelId ?? null,
			trackingNumber: tracking?.trackingNumber ?? null,
			trackingUrl: tracking?.trackingUrl ?? null,
			...PACKAGE,
			address_first_name: address.first_name,
			address_last_name: address.last_name,
			address_phone: address.phone,
			address_company: address.company,
			address_street_number: address.street_number,
			address_street: address.street,
			address_city: address.city,
			address_county: address.county,
			address_state: address.state,
			address_stateLetter: address.stateLetter,
			address_state_code: address.state_code,
			address_zip: address.zip,
			address_country: address.country,
			address_country_code: address.country_code,
			address_ISO_3166_1_alpha_3: address.ISO_3166_1_alpha_3,
			billing_first_name: address.first_name,
			billing_last_name: address.last_name,
			billing_phone: address.phone,
			billing_company: address.company,
			billing_street_number: address.street_number,
			billing_street: address.street,
			billing_city: address.city,
			billing_county: address.county,
			billing_state: address.state,
			billing_stateLetter: address.stateLetter,
			billing_state_code: address.state_code,
			billing_zip: address.zip,
			billing_country: address.country,
			billing_country_code: address.country_code,
			billing_ISO_3166_1_alpha_3: address.ISO_3166_1_alpha_3,
			servicePointId: shipping.servicePointId ?? null,
			servicePointPostNumber: shipping.servicePointPostNumber ?? null,
			servicePointLatitude: shipping.servicePointLatitude ?? null,
			servicePointLongitude: shipping.servicePointLongitude ?? null,
			servicePointType: shipping.servicePointType ?? null,
			servicePointExtraRefCab: shipping.servicePointExtraRefCab ?? null,
			servicePointExtraShopRef: shipping.servicePointExtraShopRef ?? null,
			products: snapshotProducts(order.items)
		}
	});

	return order;
}

async function main() {
	console.log('Nettoyage de la base…');
	await truncate();

	const passwordHash = await hash(DEMO_PASSWORD, ARGON2);

	const adminUser = await createDemoUser({
		email: ADMIN_EMAIL,
		username: 'Admin',
		name: 'Admin AS7',
		role: 'ADMIN',
		emailVerified: true,
		isMfaEnabled: false,
		createdAt: atUtc(2026, 0, 8),
		passwordHash
	});

	const lea = await createDemoUser({
		email: 'lea@atelier-nord.fr',
		username: 'lea-martin',
		name: 'Léa Martin',
		role: 'CLIENT',
		emailVerified: true,
		isMfaEnabled: false,
		createdAt: atUtc(2026, 4, 12),
		passwordHash
	});

	const marc = await createDemoUser({
		email: 'marc.durand@example.com',
		username: 'marc-durand',
		name: 'Marc Durand',
		role: 'CLIENT',
		emailVerified: true,
		isMfaEnabled: true,
		createdAt: atUtc(2026, 5, 3),
		passwordHash
	});

	const claire = await createDemoUser({
		email: 'claire.morel@gmail.com',
		username: null,
		name: 'Claire Morel',
		role: 'CLIENT',
		emailVerified: true,
		isMfaEnabled: false,
		googleId: 'google-oauth-demo-claire',
		picture:
			'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=128&q=80',
		createdAt: atUtc(2026, 6, 18),
		passwordHash
	});

	const nina = await createDemoUser({
		email: 'nina.petit@example.com',
		username: 'nina-petit',
		name: 'Nina Petit',
		role: 'CLIENT',
		emailVerified: false,
		isMfaEnabled: false,
		createdAt: atUtc(2026, 7, 19),
		passwordHash
	});

	await prisma.emailVerificationRequest.create({
		data: {
			id: 'seed_email_verify_nina',
			userId: nina.id,
			email: nina.email,
			code: '84729103',
			expiresAt: atUtc(2026, 7, 20, 12),
			createdAt: atUtc(2026, 7, 19, 11)
		}
	});

	console.log('5 comptes créés (1 admin, 4 clients).');

	const leaShipping = await prisma.address.create({
		data: {
			userId: lea.id,
			first_name: 'Léa',
			last_name: 'Martin',
			phone: '+33645127890',
			company: 'Atelier Nord',
			street_number: '18',
			street: 'Rue de la Folie-Méricourt',
			createdAt: atUtc(2026, 4, 12, 11),
			...PARIS
		}
	});

	await prisma.address.create({
		data: {
			userId: lea.id,
			first_name: 'Léa',
			last_name: 'Martin',
			phone: '+33645127890',
			company: 'Atelier Nord',
			street_number: '18',
			street: 'Rue de la Folie-Méricourt',
			createdAt: atUtc(2026, 4, 12, 11),
			...PARIS
		}
	});

	const marcShipping = await prisma.address.create({
		data: {
			userId: marc.id,
			first_name: 'Marc',
			last_name: 'Durand',
			phone: '+33788901234',
			company: 'Durand Conseil',
			street_number: '4',
			street: 'Place des Jacobins',
			createdAt: atUtc(2026, 5, 4),
			...LYON
		}
	});

	const claireShipping = await prisma.address.create({
		data: {
			userId: claire.id,
			first_name: 'Claire',
			last_name: 'Morel',
			phone: '+33612004567',
			street_number: '9',
			street: 'Rue des Archives',
			createdAt: atUtc(2026, 6, 18, 12),
			...PARIS,
			zip: '75004'
		}
	});

	console.log('4 adresses créées (Léa livraison/facturation, Marc, Claire).');

	// slug de taxonomie -> Map<value, taxonomyValueId>
	const taxonomyValueIdsBySlug = new Map();
	let taxonomyValueCount = 0;
	for (const taxonomy of TAXONOMIES) {
		const created = await prisma.taxonomy.create({
			data: {
				name: taxonomy.name,
				slug: taxonomy.slug,
				type: taxonomy.type,
				multiple: taxonomy.multiple
			}
		});
		const valueIds = new Map();
		for (const value of taxonomy.values) {
			const createdValue = await prisma.taxonomyValue.create({
				data: { taxonomyId: created.id, value, label: value }
			});
			valueIds.set(value, createdValue.id);
		}
		taxonomyValueIdsBySlug.set(taxonomy.slug, valueIds);
		taxonomyValueCount += valueIds.size;
	}

	const productsBySlug = new Map();
	for (const product of PRODUCTS) {
		const taxonomyValueIds = [
			taxonomyValueIdsBySlug.get('categorie').get(product.category),
			...(product.discipline
				? [taxonomyValueIdsBySlug.get('discipline').get(product.discipline)]
				: [])
		];
		const created = await prisma.product.create({
			data: {
				name: product.name,
				description: product.description,
				price: product.price,
				stock: product.stock,
				weight: product.weight ?? null,
				length: product.length ?? null,
				width: product.width ?? null,
				height: product.height ?? null,
				images: [product.image],
				slug: product.slug,
				colorProduct: product.colorProduct,
				taxonomyValues: {
					create: taxonomyValueIds.map((taxonomyValueId) => ({ taxonomyValueId }))
				}
			}
		});
		productsBySlug.set(product.slug, created);
	}
	console.log(
		`${PRODUCTS.length} produits, ${TAXONOMIES.length} taxonomies et ${taxonomyValueCount} valeurs créés.`
	);

	const casque = productsBySlug.get('casque-cross-carbon');
	const gants = productsBySlug.get('gants-cross-grip');
	const transmission = productsBySlug.get('kit-transmission-520');
	const lunettes = productsBySlug.get('lunettes-cross-vision');
	const huile = productsBySlug.get('huile-moteur-4t-10w40');
	const leveMoto = productsBySlug.get('leve-moto-atelier');

	await prisma.promoCode.createMany({
		data: [
			{
				code: 'WELCOME10',
				type: 'PERCENTAGE',
				value: 10,
				minAmount: 20,
				usageCount: 1,
				active: true
			},
			{
				code: 'FIXED5',
				type: 'FIXED',
				value: 5,
				minAmount: 30,
				usageLimit: 100,
				usageCount: 12,
				active: true
			},
			{
				code: 'SUMMER25',
				type: 'PERCENTAGE',
				value: 25,
				minAmount: 200,
				expiresAt: atUtc(2026, 6, 31),
				active: true
			},
			{
				code: 'PARK50',
				type: 'FIXED',
				value: 50,
				minAmount: 500,
				usageLimit: 10,
				usageCount: 10,
				active: true
			},
			{
				code: 'OLDLAUNCH',
				type: 'PERCENTAGE',
				value: 15,
				active: false
			}
		]
	});
	console.log('5 codes promo créés (actif, utilisé, expiré, épuisé, inactif).');

	await createPaidFlow({
		user: lea,
		address: leaShipping,
		status: 'PAID',
		createdAt: atUtc(2026, 6, 22, 9),
		history: [
			{ status: 'PENDING', changedAt: atUtc(2026, 6, 21, 16) },
			{ status: 'PAID', changedAt: atUtc(2026, 6, 22, 9) }
		],
		lines: [
			{ product: gants, quantity: 2 },
			{ product: lunettes, quantity: 1 }
		],
		stripePaymentId: 'cs_seed_july_gants'
	});

	await createPaidFlow({
		user: lea,
		address: leaShipping,
		status: 'PAID',
		createdAt: atUtc(2026, 7, 3, 11),
		history: [
			{ status: 'PENDING', changedAt: atUtc(2026, 7, 2, 18) },
			{ status: 'PAID', changedAt: atUtc(2026, 7, 3, 11) }
		],
		lines: [{ product: casque, quantity: 1 }],
		stripePaymentId: 'cs_seed_aug_casque',
		custom: {
			image:
				'https://images.unsplash.com/photo-1609630875171-b1321377ee65?auto=format&fit=crop&w=800&q=80',
			userMessage: 'Numéro de course 77 et nom « LÉA » sur l’arrière du casque, lettrage noir.'
		}
	});

	const welcomeDiscount = money(transmission.price * 0.1);
	await createPaidFlow({
		user: lea,
		address: leaShipping,
		status: 'SHIPPED',
		createdAt: atUtc(2026, 7, 12, 14),
		history: [
			{ status: 'PENDING', changedAt: atUtc(2026, 7, 11, 10) },
			{ status: 'PAID', changedAt: atUtc(2026, 7, 12, 14) },
			{ status: 'SHIPPED', changedAt: atUtc(2026, 7, 14, 8) }
		],
		lines: [{ product: transmission, quantity: 1 }],
		shipping: RELAY,
		promoCode: 'WELCOME10',
		discountAmount: welcomeDiscount,
		stripePaymentId: 'cs_seed_aug_transmission',
		tracking: {
			sendcloudParcelId: 884512,
			trackingNumber: 'MR123456789FR',
			trackingUrl: 'https://www.mondialrelay.fr/suivi-de-colis/?numero=MR123456789FR'
		}
	});

	await createPaidFlow({
		user: marc,
		address: marcShipping,
		status: 'PAID',
		createdAt: atUtc(2026, 7, 18, 16),
		history: [
			{ status: 'PENDING', changedAt: atUtc(2026, 7, 17, 9) },
			{ status: 'PAID', changedAt: atUtc(2026, 7, 18, 16) }
		],
		lines: [{ product: leveMoto, quantity: 1 }],
		stripePaymentId: 'cs_seed_aug_leve_moto'
	});

	await createPaidFlow({
		user: marc,
		address: marcShipping,
		status: 'PAID',
		createdAt: atUtc(2026, 7, 21, 10),
		history: [
			{ status: 'PENDING', changedAt: atUtc(2026, 7, 20, 19) },
			{ status: 'PAID', changedAt: atUtc(2026, 7, 21, 10) }
		],
		lines: [{ product: huile, quantity: 2 }],
		stripePaymentId: 'cs_seed_aug_huile'
	});

	await createPaidFlow({
		user: claire,
		address: claireShipping,
		status: 'CANCELLED',
		createdAt: atUtc(2026, 7, 8, 13),
		history: [
			{ status: 'PENDING', changedAt: atUtc(2026, 7, 8, 13) },
			{ status: 'CANCELLED', changedAt: atUtc(2026, 7, 9, 9) }
		],
		lines: [{ product: casque, quantity: 1 }]
	});

	await prisma.order.create({
		data: {
			userId: lea.id,
			shippingAddressId: leaShipping.id,
			billingAddressId: leaShipping.id,
			status: 'PENDING',
			...vatFromTtc(huile.price),
			shippingOption: 'no_shipping',
			shippingCost: 0,
			createdAt: atUtc(2026, 7, 22, 15),
			items: {
				create: {
					productId: huile.id,
					quantity: 1,
					price: huile.price
				}
			},
			statusHistory: {
				create: { status: 'PENDING', changedAt: atUtc(2026, 7, 22, 15) }
			}
		}
	});

	console.log('6 commandes créées (panier, payée, expédiée, annulée) + 5 transactions.');

	await prisma.review.createMany({
		data: [
			{
				productId: gants.id,
				userId: lea.id,
				rating: 5,
				comment: 'Bonne tenue en main, même après une journée de roulage. Taille normalement.',
				createdAt: atUtc(2026, 6, 25)
			},
			{
				productId: transmission.id,
				userId: lea.id,
				rating: 4,
				comment:
					'Kit complet et de qualité, bien vérifier la référence de sa moto avant de commander.',
				createdAt: atUtc(2026, 7, 16)
			},
			{
				productId: leveMoto.id,
				userId: marc.id,
				rating: 5,
				comment: 'Solide et stable, indispensable pour graisser la chaîne à la maison.',
				createdAt: atUtc(2026, 7, 20)
			}
		]
	});
	console.log('3 avis produit créés.');

	await prisma.wishlistItem.createMany({
		data: [
			{ userId: claire.id, productId: casque.id, createdAt: atUtc(2026, 7, 9) },
			{ userId: nina.id, productId: lunettes.id, createdAt: atUtc(2026, 7, 19, 12) }
		]
	});
	console.log('2 lignes de liste d’envies créées.');

	await prisma.storeSettings.create({
		// TVA au taux normal (20 %), cohérente avec `vatFromTtc` ci-dessus.
		data: { wishlistEnabled: true, crossSellEnabled: true, vatRate: 0.2 }
	});
	console.log('Réglages boutique créés (liste d’envies, ventes croisées, TVA 20 %).');

	const teamAuthor = await prisma.blogAuthor.create({
		data: { name: adminUser.name ?? 'Admin AS7' }
	});
	const mechanicAuthor = await prisma.blogAuthor.create({
		data: { name: 'Lucas — atelier mécanique' }
	});

	// BLOG-PLUGIN : taxonomies génériques (voir docs/blog/README.md).
	const categoryTaxonomy = await prisma.blogTaxonomy.create({
		data: { name: 'Catégorie', slug: 'categorie', multiple: false }
	});
	const tagTaxonomy = await prisma.blogTaxonomy.create({
		data: { name: 'Tag', slug: 'tag', multiple: true }
	});

	const adviceCategory = await prisma.blogTaxonomyValue.create({
		data: { taxonomyId: categoryTaxonomy.id, value: 'Conseils' }
	});
	const maintenanceCategory = await prisma.blogTaxonomyValue.create({
		data: { taxonomyId: categoryTaxonomy.id, value: 'Entretien' }
	});

	const tagDesign = await prisma.blogTaxonomyValue.create({
		data: { taxonomyId: tagTaxonomy.id, value: 'Équipement' }
	});
	const tagTech = await prisma.blogTaxonomyValue.create({
		data: { taxonomyId: tagTaxonomy.id, value: 'Mécanique' }
	});
	const tagCulture = await prisma.blogTaxonomyValue.create({
		data: { taxonomyId: tagTaxonomy.id, value: 'Pilotage' }
	});

	const parseBlogDate = (value) => {
		const [day, month, yearRaw] = String(value).split('.');
		const year = Number(yearRaw) < 100 ? 2000 + Number(yearRaw) : Number(yearRaw);
		return new Date(Date.UTC(year, Number(month) - 1, Number(day), 9, 0, 0));
	};

	const createdPosts = [];
	for (const [index, article] of blog.entries()) {
		const createdAt = parseBlogDate(article.date);
		const post = await prisma.blogPost.create({
			data: {
				title: article.title,
				content: article.content,
				slug: article.link,
				published: true,
				authorId: index % 3 === 1 ? mechanicAuthor.id : teamAuthor.id,
				createdAt,
				updatedAt: createdAt,
				taxonomyValues: {
					create: [
						{ taxonomyValueId: index >= 4 ? maintenanceCategory.id : adviceCategory.id },
						{ taxonomyValueId: tagCulture.id },
						...(index % 2 === 0
							? [{ taxonomyValueId: tagDesign.id }]
							: [{ taxonomyValueId: tagTech.id }])
					]
				}
			}
		});
		createdPosts.push(post);
	}

	await prisma.blogPost.create({
		data: {
			title: 'Brouillon : guide des tailles de casques',
			slug: 'brouillon-guide-tailles-casques',
			published: false,
			authorId: teamAuthor.id,
			taxonomyValues: { create: { taxonomyValueId: maintenanceCategory.id } },
			createdAt: atUtc(2026, 7, 20),
			content: `
				<p>Notes internes : tableau des tailles par marque, méthode de mesure du tour de tête, photos à prévoir.</p>
				<p>Ce brouillon n’est pas publié — il n’apparaît que dans l’admin.</p>
			`
		}
	});

	await prisma.blogComment.createMany({
		data: [
			{
				postId: createdPosts[0].id,
				author: 'Léa Martin',
				content: 'Super guide, j’ai enfin compris quand changer ma chaîne. Merci !',
				createdAt: atUtc(2026, 0, 8)
			},
			{
				postId: createdPosts[0].id,
				author: 'Marc Durand',
				content: 'Vous proposez aussi le montage en atelier ou seulement la vente des pièces ?',
				createdAt: atUtc(2026, 0, 9)
			}
		]
	});

	console.log(`${blog.length} articles publiés, 1 brouillon, 3 tags, 2 commentaires.`);

	await prisma.contactSubmission.createMany({
		data: [
			{
				name: 'Sophie Bernard',
				email: 'sophie.bernard@example.com',
				subject: 'Taille de casque',
				message:
					'Bonjour, j’ai un tour de tête de 57 cm : quelle taille me conseillez-vous pour le casque cross AS7 Carbon ?',
				createdAt: atUtc(2026, 7, 5, 9)
			},
			{
				name: 'Julien Lefèvre',
				email: 'julien.lefevre@example.com',
				subject: 'Compatibilité kit transmission',
				message:
					'Le kit transmission 520 est-il compatible avec une KTM 250 EXC de 2021 ? Merci d’avance.',
				createdAt: atUtc(2026, 7, 14, 15)
			},
			{
				name: 'MX Club Vendée',
				email: 'contact@mxclub-vendee.fr',
				subject: 'Partenariat club',
				message:
					'Notre club cherche un partenaire équipement pour la saison prochaine (tarifs licenciés, dotation pilotes). Intéressés pour en discuter ?',
				createdAt: atUtc(2026, 7, 21, 11)
			}
		]
	});
	console.log('3 messages de contact créés.');

	console.log('\nComptes de démonstration (mot de passe : ' + DEMO_PASSWORD + ')');
	console.log(`  ${ADMIN_EMAIL}          ADMIN`);
	console.log('  lea@atelier-nord.fr            CLIENT vérifié, panier + factures');
	console.log('  marc.durand@example.com        CLIENT 2FA activée');
	console.log('  claire.morel@gmail.com         CLIENT Google (pas de mot de passe local)');
	console.log('  nina.petit@example.com         CLIENT e-mail non vérifié');
}

main()
	.then(() => console.log('\nSeed terminé.'))
	.catch((error) => {
		console.error('Échec du seed :', error);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());
