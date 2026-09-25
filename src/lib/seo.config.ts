// Configuration SEO pour MadeInDiamonds — boutique de bijoux et joaillerie
// en ligne (bagues, colliers, créations en métaux précieux et diamants).
export const seoConfig = {
	// Informations de base du site
	site: {
		name: 'MadeInDiamonds',
		url: 'https://madeindiamonds.com',
		description:
			'MadeInDiamonds — joaillerie en ligne. Bagues, colliers et bijoux en métaux précieux et diamants, livrés en France et en Europe.',
		keywords:
			'bijouterie en ligne, joaillerie, bagues, colliers, diamants, métaux précieux, bijoux sur-mesure, MadeInDiamonds',
		author: 'MadeInDiamonds',
		locale: 'fr_FR'
	},

	// Métadonnées par défaut
	defaults: {
		title: 'MadeInDiamonds — Joaillerie en ligne',
		description:
			'Découvrez MadeInDiamonds, joaillerie en ligne spécialisée dans les bagues, colliers et créations en métaux précieux et diamants.',
		keywords:
			'bijouterie en ligne, joaillerie, bagues, colliers, diamants, métaux précieux, MadeInDiamonds',
		image: '/og-default.jpg',
		type: 'website'
	},

	// Configuration des pages principales
	pages: {
		home: {
			title: 'MadeInDiamonds — Bijoux et joaillerie en ligne',
			description:
				'Découvrez la collection MadeInDiamonds : bagues, colliers et créations en métaux précieux et diamants, livrées en France et en Europe.',
			keywords: 'bijouterie en ligne, joaillerie, bagues, colliers, diamants, MadeInDiamonds',
			image: '/og-home.jpg'
		},
		blog: {
			title: 'Blog — Conseils bijoux et joaillerie',
			description:
				"Guides d'entretien, tendances et actualités de la joaillerie par MadeInDiamonds.",
			keywords: 'blog joaillerie, entretien bijoux, tendances bijoux, MadeInDiamonds',
			image: '/og-blog.jpg'
		},
		products: {
			title: 'Nos bijoux — Bagues, colliers et créations en diamants',
			description:
				'Parcourez la collection MadeInDiamonds : bagues, colliers et boucles d’oreilles en métaux précieux et diamants.',
			keywords: 'bagues, colliers, boucles d’oreilles, diamants, métaux précieux, bijoux',
			image: '/og-products.jpg'
		},
		contact: {
			title: 'Contact — Une question sur une commande ou un bijou',
			description:
				'Contactez MadeInDiamonds pour toute question sur nos bijoux, une commande ou un rendez-vous.',
			keywords: 'contact bijouterie, service client, commande, MadeInDiamonds',
			image: '/og-contact.jpg'
		},
		checkout: {
			title: 'Commande — Finalisez votre achat',
			description:
				'Finalisez votre commande de bijoux MadeInDiamonds. Paiement sécurisé et confirmation par e-mail.',
			keywords: 'commande bijoux, paiement sécurisé, joaillerie en ligne',
			image: '/og-checkout.jpg'
		},
		checkoutSuccess: {
			title: 'Commande confirmée — MadeInDiamonds',
			description: 'Votre commande de bijoux a été confirmée. Merci pour votre confiance.',
			keywords: 'commande confirmée, succès, MadeInDiamonds',
			image: '/og-checkout-success.jpg'
		},
		error: {
			title: 'Page non trouvée — MadeInDiamonds',
			description:
				'La page que vous recherchez n’existe pas. Retournez à l’accueil pour découvrir nos bijoux.',
			keywords: 'page non trouvée, erreur 404, MadeInDiamonds',
			image: '/og-error.jpg'
		},
		auth: {
			title: 'Authentification — MadeInDiamonds',
			description:
				'Connectez-vous à votre compte MadeInDiamonds pour suivre vos commandes et vos bijoux favoris.',
			keywords: 'connexion, authentification, compte, MadeInDiamonds',
			image: '/og-auth.jpg'
		},
		admin: {
			title: 'Administration — MadeInDiamonds',
			description:
				'Panneau d’administration MadeInDiamonds. Gérez vos produits, commandes et utilisateurs.',
			keywords: 'administration, gestion, produits, commandes, utilisateurs, MadeInDiamonds',
			image: '/og-admin.jpg'
		}
	},

	// Configuration des réseaux sociaux
	social: {
		twitter: {
			site: '@madeindiamonds',
			creator: '@madeindiamonds'
		},
		facebook: {
			appId: 'votre-app-id-facebook'
		}
	}
};
