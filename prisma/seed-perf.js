// -----------------------------------------------------------------------------
// Seed de volume pour tester la pagination/perf en conditions réalistes.
//
// Purement additif (contrairement à `seed.js` qui vide tout) : toutes les
// lignes créées ici portent un marqueur (email `@perf.test`, slug/code
// préfixé `perf-`/`PERF-`) pour rester identifiables et supprimables sans
// toucher aux données de démo ou à celles créées manuellement.
//
// Usage :
//   node prisma/seed-perf.js            → insère les volumes par défaut
//   PERF_PRODUCTS=20000 node prisma/seed-perf.js   → surcharge un volume
//   node prisma/seed-perf.js --clean    → supprime uniquement les lignes perf
// -----------------------------------------------------------------------------

import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import { hash } from '@node-rs/argon2';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const ARGON2 = { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 };
const PERF_PASSWORD = 'PerfSeed!2026';

const COUNTS = {
	categories: Number(process.env.PERF_CATEGORIES ?? 10),
	products: Number(process.env.PERF_PRODUCTS ?? 5000),
	users: Number(process.env.PERF_USERS ?? 3000),
	transactions: Number(process.env.PERF_TRANSACTIONS ?? 8000),
	contacts: Number(process.env.PERF_CONTACTS ?? 2000),
	promoCodes: Number(process.env.PERF_PROMO_CODES ?? 300),
	blogPosts: Number(process.env.PERF_BLOG_POSTS ?? 1500)
};

const BATCH_SIZE = 1000;

async function chunkedCreateMany(model, rows, label) {
	for (let i = 0; i < rows.length; i += BATCH_SIZE) {
		const batch = rows.slice(i, i + BATCH_SIZE);
		await model.createMany({ data: batch, skipDuplicates: true });
		console.log(`  ${label} : ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
	}
}

async function clean() {
	console.log('Suppression des données perf existantes…');
	await prisma.transaction.deleteMany({ where: { stripePaymentId: { startsWith: 'perf_' } } });
	await prisma.blogPost.deleteMany({ where: { slug: { startsWith: 'perf-' } } }); // cascade → blog_post_tags
	await prisma.blogAuthor.deleteMany({ where: { name: 'Perf Bot' } });
	await prisma.blogCategory.deleteMany({ where: { name: 'Perf' } });
	await prisma.product.deleteMany({ where: { slug: { startsWith: 'perf-' } } }); // cascade → product_categories
	await prisma.category.deleteMany({ where: { name: { startsWith: 'Perf ' } } });
	await prisma.contactSubmission.deleteMany({ where: { email: { endsWith: '@perf.test' } } });
	await prisma.promoCode.deleteMany({ where: { code: { startsWith: 'PERF-' } } });
	await prisma.user.deleteMany({ where: { email: { endsWith: '@perf.test' } } }); // transactions.userId → SetNull
	console.log('Nettoyage terminé.');
}

const PACKAGE_DEFAULTS = {
	shippingMethodId: 1,
	shippingMethodName: 'Livraison standard',
	package_length: 30,
	package_width: 20,
	package_height: 10,
	package_dimension_unit: 'cm',
	package_weight: 1,
	package_weight_unit: 'kg',
	package_volume: 6000,
	package_volume_unit: 'cm3'
};

async function seedCategories() {
	const rows = Array.from({ length: COUNTS.categories }, (_, i) => ({
		id: randomUUID(),
		name: `Perf ${i + 1}`
	}));
	await chunkedCreateMany(prisma.category, rows, 'catégories');
	return rows;
}

async function seedProducts(categories) {
	const rows = Array.from({ length: COUNTS.products }, (_, i) => ({
		id: randomUUID(),
		name: faker.commerce.productName(),
		description: faker.commerce.productDescription(),
		price: faker.number.float({ min: 10, max: 15000, fractionDigits: 2 }),
		stock: faker.number.int({ min: 0, max: 500 }),
		images: [faker.image.urlPicsumPhotos()],
		slug: `perf-product-${i}-${randomUUID().slice(0, 8)}`,
		colorProduct: faker.color.rgb(),
		createdAt: faker.date.past({ years: 2 })
	}));
	await chunkedCreateMany(prisma.product, rows, 'produits');

	const joinRows = rows.map((product) => ({
		id: randomUUID(),
		productId: product.id,
		categoryId: faker.helpers.arrayElement(categories).id
	}));
	await chunkedCreateMany(prisma.productCategory, joinRows, 'produits ↔ catégories');
	return rows;
}

async function seedUsers() {
	const passwordHash = await hash(PERF_PASSWORD, ARGON2);
	const rows = Array.from({ length: COUNTS.users }, (_, i) => ({
		id: randomUUID(),
		email: `perf-user-${i}@perf.test`,
		username: `perf_user_${i}`,
		name: faker.person.fullName(),
		role: 'CLIENT',
		emailVerified: true,
		isMfaEnabled: false,
		passwordHash,
		createdAt: faker.date.past({ years: 2 })
	}));
	await chunkedCreateMany(prisma.user, rows, 'utilisateurs');
	return rows;
}

async function seedTransactions(users) {
	const statuses = ['paid', 'paid', 'paid', 'pending', 'failed'];
	const rows = Array.from({ length: COUNTS.transactions }, (_, i) => {
		const user = faker.helpers.arrayElement(users);
		const amount = faker.number.float({ min: 20, max: 20000, fractionDigits: 2 });
		return {
			id: randomUUID(),
			stripePaymentId: `perf_txn_${i}_${randomUUID().slice(0, 8)}`,
			userId: user.id,
			amount,
			currency: 'eur',
			customer_details_email: user.email,
			customer_details_name: user.name,
			customer_details_phone: faker.phone.number(),
			status: faker.helpers.arrayElement(statuses),
			createdAt: faker.date.past({ years: 2 }),
			shippingOption: 'colissimo/domicile',
			shippingCost: faker.number.float({ min: 0, max: 15, fractionDigits: 2 }),
			...PACKAGE_DEFAULTS,
			address_first_name: faker.person.firstName(),
			address_last_name: faker.person.lastName(),
			address_phone: faker.phone.number(),
			address_company: null,
			address_street_number: faker.location.buildingNumber(),
			address_street: faker.location.street(),
			address_city: faker.location.city(),
			address_county: faker.location.county(),
			address_state: faker.location.state(),
			address_stateLetter: faker.location.state({ abbreviated: true }),
			address_state_code: faker.location.state({ abbreviated: true }),
			address_zip: faker.location.zipCode(),
			address_country: 'France',
			address_country_code: 'FR',
			address_ISO_3166_1_alpha_3: 'FRA',
			address_type: 'SHIPPING',
			products: [
				{
					id: randomUUID(),
					name: faker.commerce.productName(),
					price: amount,
					quantity: 1,
					description: '',
					stock: 0,
					images: [],
					customizations: []
				}
			]
		};
	});
	await chunkedCreateMany(prisma.transaction, rows, 'transactions');
}

async function seedContacts() {
	const rows = Array.from({ length: COUNTS.contacts }, (_, i) => ({
		id: randomUUID(),
		name: faker.person.fullName(),
		email: `perf-contact-${i}@perf.test`,
		subject: faker.lorem.sentence(6),
		message: faker.lorem.paragraph(),
		createdAt: faker.date.past({ years: 2 })
	}));
	await chunkedCreateMany(prisma.contactSubmission, rows, 'messages de contact');
}

async function seedPromoCodes() {
	const rows = Array.from({ length: COUNTS.promoCodes }, (_, i) => {
		const type = faker.helpers.arrayElement(['PERCENTAGE', 'FIXED']);
		return {
			id: randomUUID(),
			code: `PERF-${i}-${randomUUID().slice(0, 6).toUpperCase()}`,
			type,
			value: type === 'PERCENTAGE' ? faker.number.int({ min: 5, max: 50 }) : faker.number.int({ min: 5, max: 100 }),
			minAmount: faker.datatype.boolean() ? faker.number.float({ min: 10, max: 200, fractionDigits: 2 }) : null,
			usageLimit: faker.datatype.boolean() ? faker.number.int({ min: 10, max: 500 }) : null,
			usageCount: faker.number.int({ min: 0, max: 50 }),
			active: faker.datatype.boolean(),
			createdAt: faker.date.past({ years: 2 })
		};
	});
	await chunkedCreateMany(prisma.promoCode, rows, 'codes promo');
}

async function seedBlog() {
	const author = await prisma.blogAuthor.upsert({
		where: { name: 'Perf Bot' },
		update: {},
		create: { id: randomUUID(), name: 'Perf Bot' }
	});
	const category = await prisma.blogCategory.upsert({
		where: { name: 'Perf' },
		update: {},
		create: { id: randomUUID(), name: 'Perf', description: 'Articles générés pour les tests de charge.' }
	});

	const rows = Array.from({ length: COUNTS.blogPosts }, (_, i) => ({
		id: randomUUID(),
		title: faker.lorem.sentence(8),
		content: faker.lorem.paragraphs(3, '\n\n'),
		slug: `perf-post-${i}-${randomUUID().slice(0, 8)}`,
		published: faker.datatype.boolean({ probability: 0.85 }),
		authorId: author.id,
		categoryId: category.id,
		createdAt: faker.date.past({ years: 2 })
	}));
	await chunkedCreateMany(prisma.blogPost, rows, 'articles de blog');
}

async function main() {
	if (process.argv.includes('--clean')) {
		await clean();
		return;
	}

	console.log('Volumes :', COUNTS);

	const categories = await seedCategories();
	const products = await seedProducts(categories);
	const users = await seedUsers();
	await seedTransactions(users);
	await seedContacts();
	await seedPromoCodes();
	await seedBlog();

	console.log('\nSeed perf terminé :');
	console.log(`  ${products.length} produits, ${categories.length} catégories perf`);
	console.log(`  ${users.length} utilisateurs (mot de passe : ${PERF_PASSWORD})`);
	console.log(`  ${COUNTS.transactions} transactions, ${COUNTS.contacts} messages, ${COUNTS.promoCodes} codes promo, ${COUNTS.blogPosts} articles`);
	console.log('\nPour nettoyer : node prisma/seed-perf.js --clean');
}

main()
	.catch((error) => {
		console.error('Échec du seed perf :', error);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());
