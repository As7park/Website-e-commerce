// Configuration SEO pour AS7 Park — boutique en ligne d'articles moto
// (équipement pilote, pièces, accessoires et entretien).
export const seoConfig = {
	// Informations de base du site
	site: {
		name: 'AS7 Park',
		url: 'https://as7park.com',
		description:
			'AS7 Park — boutique moto en ligne. Équipement pilote, pièces, accessoires et produits d’entretien, livrés en France et en Europe.',
		keywords:
			'boutique moto, équipement moto, casque moto, gants moto, pièces moto, accessoires moto, motocross, entretien moto, AS7 Park',
		author: 'AS7 Park',
		locale: 'fr_FR'
	},

	// Métadonnées par défaut
	defaults: {
		title: 'AS7 Park — Boutique moto en ligne',
		description:
			'Découvrez AS7 Park, boutique moto en ligne : équipement pilote, pièces, accessoires et entretien pour rouler en toute confiance.',
		keywords:
			'boutique moto, équipement moto, pièces moto, accessoires moto, motocross, entretien moto, AS7 Park',
		image: '/og-default.jpg',
		type: 'website'
	},

	// Configuration des pages principales — `image` identique partout
	// (`/og-default.jpg`) tant qu'aucun visuel distinct par page n'existe.
	pages: {
		home: {
			title: 'AS7 Park — Équipement, pièces et accessoires moto',
			description:
				'Découvrez la sélection AS7 Park : casques, gants, équipement pilote, pièces et accessoires moto, livrés en France et en Europe.',
			keywords: 'boutique moto, équipement moto, casque, gants, pièces moto, AS7 Park',
			image: '/og-default.jpg'
		},
		blog: {
			title: 'Blog — Conseils moto, entretien et pilotage',
			description: 'Guides d’entretien, conseils d’équipement et actualités moto par AS7 Park.',
			keywords: 'blog moto, entretien moto, équipement pilote, conseils moto, AS7 Park',
			image: '/og-default.jpg'
		},
		products: {
			title: 'La boutique — Équipement, pièces et accessoires moto',
			description:
				'Parcourez la boutique AS7 Park : casques, gants, bottes, pièces, accessoires et produits d’entretien moto.',
			keywords: 'casque moto, gants moto, bottes moto, pièces moto, accessoires moto, entretien',
			image: '/og-default.jpg'
		},
		contact: {
			title: 'Contact — Une question sur une commande ou un article',
			description:
				'Contactez AS7 Park pour toute question sur nos articles moto, une commande ou un conseil d’équipement.',
			keywords: 'contact boutique moto, service client, commande, AS7 Park',
			image: '/og-default.jpg'
		},
		checkout: {
			title: 'Commande — Finalisez votre achat',
			description:
				'Finalisez votre commande AS7 Park. Paiement sécurisé et confirmation par e-mail.',
			keywords: 'commande moto, paiement sécurisé, boutique moto en ligne',
			image: '/og-default.jpg'
		},
		checkoutSuccess: {
			title: 'Commande confirmée — AS7 Park',
			description: 'Votre commande a été confirmée. Merci pour votre confiance.',
			keywords: 'commande confirmée, succès, AS7 Park',
			image: '/og-default.jpg'
		},
		error: {
			title: 'Page non trouvée — AS7 Park',
			description:
				'La page que vous recherchez n’existe pas. Retournez à l’accueil pour découvrir nos articles moto.',
			keywords: 'page non trouvée, erreur 404, AS7 Park',
			image: '/og-default.jpg'
		}
		// `auth` et `admin` retirés : tout /auth/* et /admin/* est en `noindex`
		// (voir les +layout.svelte respectifs), un titre SEO dédié n'a plus
		// d'utilité pour des pages jamais indexées.
	},

	// Configuration des réseaux sociaux
	social: {
		twitter: {
			site: '@as7park',
			creator: '@as7park'
		},
		facebook: {
			appId: 'votre-app-id-facebook'
		}
	}
};
