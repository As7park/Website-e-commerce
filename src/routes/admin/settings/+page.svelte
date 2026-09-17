<script lang="ts">
	import { enhance } from '$app/forms';
	import { tick, untrack } from 'svelte';
	import { Switch } from '$shadcn/switch';
	import { Label } from '$shadcn/label';
	import { Button } from '$shadcn/button';
	import * as Dialog from '$shadcn/dialog';
	import { toast } from 'svelte-sonner';

	let { data, form } = $props();

	type FlagKey =
		| 'wishlistEnabled'
		| 'crossSellEnabled'
		| 'returnsEnabled'
		| 'savedPaymentsEnabled'
		| 'loyaltyEnabled'
		| 'giftCardsEnabled'
		| 'productQnaEnabled'
		| 'cartRecoveryEnabled'
		| 'referralEnabled'
		| 'stockAlertsEnabled'
		| 'frequentlyBoughtTogetherEnabled';

	type ModuleCategory =
		| 'Produits & découverte'
		| 'Paiement & après-vente'
		| 'Marketing & fidélisation';

	const CATEGORY_ORDER: ModuleCategory[] = [
		'Produits & découverte',
		'Paiement & après-vente',
		'Marketing & fidélisation'
	];

	type ModuleInfo = {
		key: FlagKey;
		category: ModuleCategory;
		label: string;
		description: string;
		details: string;
	};

	const MODULES: ModuleInfo[] = [
		{
			key: 'wishlistEnabled',
			category: 'Produits & découverte',
			label: 'Liste d’envies',
			description:
				'Un cœur sur chaque fiche produit pour enregistrer un article à retrouver plus tard, visible depuis le compte client.',
			details:
				"Le client clique sur l'icône cœur d'une fiche produit (connecté obligatoire) ; l'article rejoint sa liste, consultable depuis son espace « Mes favoris ». Un même produit ne peut être ajouté qu'une fois par compte. Aucune action admin n'est nécessaire une fois le module activé — rien à configurer ni à modérer côté back-office."
		},
		{
			key: 'crossSellEnabled',
			category: 'Produits & découverte',
			label: 'Ventes croisées',
			description:
				'Bloc « Vous aimerez aussi » sur la fiche produit, basé sur la catégorie de l’article consulté.',
			details:
				"Sur chaque fiche produit s'affiche un bloc « Vous aimerez aussi » avec quelques produits de la même catégorie. La sélection est entièrement automatique (catégorie du produit consulté) : aucune association manuelle à saisir, rien à gérer une fois le module activé."
		},
		{
			key: 'returnsEnabled',
			category: 'Paiement & après-vente',
			label: 'Espace retour / SAV',
			description:
				'Permet à un client de déclarer un retour depuis l’historique de ses commandes plutôt que par le formulaire de contact générique.',
			details:
				"Depuis « Mes commandes », le client déclare un retour sur une commande déjà payée en indiquant un motif. La demande apparaît dans /admin/returns où l'admin l'approuve (remboursement Stripe ou crédit sous forme de carte cadeau) ou la refuse. Une étiquette de retour Sendcloud est générée automatiquement à l'approbation, sans bloquer le remboursement si elle échoue."
		},
		{
			key: 'savedPaymentsEnabled',
			category: 'Paiement & après-vente',
			label: 'Moyen de paiement enregistré',
			description:
				'Carte Stripe mémorisée pour accélérer un prochain achat, sans ressaisie au tunnel de commande.',
			details:
				"Au tunnel de commande, le client peut cocher « Mémoriser cette carte » : elle devient réutilisable en un clic lors d'un prochain achat. Gérable depuis son espace client (suppression possible). Aucune donnée de carte bancaire ne transite ni n'est stockée côté serveur — uniquement chez Stripe, seules les métadonnées d'affichage (marque, 4 derniers chiffres) sont conservées en base."
		},
		{
			key: 'loyaltyEnabled',
			category: 'Marketing & fidélisation',
			label: 'Palier de fidélité',
			description:
				'Code promo automatique après un nombre de commandes payées, sur le moteur de codes promo déjà existant.',
			details:
				"Un code promo (créé et configuré depuis /admin/promo avec un seuil de commandes) est accordé automatiquement par e-mail dès qu'un client atteint ce nombre de commandes payées. L'envoi n'a jamais lieu deux fois pour le même palier, même si le paiement déclenche l'évènement plusieurs fois."
		},
		{
			key: 'giftCardsEnabled',
			category: 'Paiement & après-vente',
			label: 'Cartes cadeaux',
			description:
				'Champ dédié au tunnel de commande pour appliquer une carte cadeau (solde décroissant), en plus d’un éventuel code promo. Émission depuis /admin/gift-cards.',
			details:
				"Le tunnel de commande affiche un champ pour saisir un code de carte cadeau à solde décroissant, cumulable avec un code promo. Les cartes s'émettent depuis /admin/gift-cards (montant initial, destinataire, date d'expiration) : le client reçoit le code par e-mail et l'utilise en une ou plusieurs fois jusqu'à épuisement du solde."
		},
		{
			key: 'productQnaEnabled',
			category: 'Produits & découverte',
			label: 'Questions & réponses produit',
			description:
				'Formulaire de question sur la fiche produit. Une question reste invisible du public tant qu’un admin n’y a pas répondu depuis /admin/products/questions.',
			details:
				"Un client pose une question libre sur une fiche produit. Elle reste invisible du public tant qu'un admin n'y a pas répondu depuis /admin/products/questions — pas de file d'attente publique ni de question sans réponse affichée aux visiteurs."
		},
		{
			key: 'cartRecoveryEnabled',
			category: 'Marketing & fidélisation',
			label: 'Relance panier abandonné',
			description:
				'Envoie un e-mail avec un code promo dégressif (10% puis 15%) aux clients qui laissent une commande en attente 1h puis 24h, sur le moteur de codes promo déjà existant.',
			details:
				"Un client qui laisse une commande en attente reçoit un e-mail de relance avec un code promo dégressif : 10% après 1h, puis 15% après 24h si la première relance n'a pas suffi. Le lien renvoie vers /checkout, où son panier est déjà rattaché automatiquement — aucun lien ni jeton spécial à gérer."
		},
		{
			key: 'referralEnabled',
			category: 'Marketing & fidélisation',
			label: 'Parrainage',
			description:
				'Lien unique par compte : le filleul obtient une remise à sa première commande, le parrain reçoit une carte cadeau une fois cette commande payée.',
			details:
				"Chaque client retrouve son lien unique depuis /auth/settings/referral (?ref=<code> ajouté à l'inscription). Le filleul bénéficie automatiquement d'une remise de 10% sur sa toute première commande payée, sans code à saisir. Dès que cette commande est payée, le parrain reçoit par e-mail une carte cadeau de 10€ (module Gift Cards, visible depuis /admin/gift-cards) — une seule fois par filleul, jamais à ses commandes suivantes."
		},
		{
			key: 'stockAlertsEnabled',
			category: 'Produits & découverte',
			label: 'Alertes réassort',
			description:
				'Bouton « Me prévenir » sur une fiche produit en rupture : e-mail automatique dès que le stock repasse au-dessus de 0.',
			details:
				"Un client connecté clique sur « Me prévenir » sur une fiche produit en rupture (stock à 0) ; son inscription rejoint une file d'attente. Dès qu'un admin remet ce produit en stock depuis /admin/products, chaque compte inscrit reçoit automatiquement un e-mail — une seule fois par rupture, sans action admin supplémentaire à effectuer."
		},
		{
			key: 'frequentlyBoughtTogetherEnabled',
			category: 'Produits & découverte',
			label: 'Souvent achetés ensemble',
			description:
				'Suggestion dans le panier basée sur les achats réels passés ensemble, avec une petite remise automatique si les deux produits restent dans le panier.',
			details:
				"Le tiroir panier suggère, pour chaque article ajouté, le produit le plus souvent commandé avec lui dans l'historique des ventes payées (au moins deux commandes en commun, jamais une simple coïncidence). Si les deux produits suggérés sont toujours dans le panier au moment de payer, une remise de 10% est appliquée automatiquement sur le total — recalculée côté serveur au paiement, jamais une simple promesse d'affichage. Aucune association manuelle à saisir : la sélection vient uniquement de l'historique des commandes."
		}
	];

	let modulesByCategory = $derived(
		CATEGORY_ORDER.map((category) => ({
			category,
			modules: MODULES.filter((module) => module.category === category)
		}))
	);

	let flags = $state(untrack(() => ({ ...data.flags })));
	let formEl: HTMLFormElement;
	let pending = $state(false);

	let detailsOpen = $state(false);
	let activeModule = $state<ModuleInfo | null>(null);

	function openDetails(module: ModuleInfo) {
		activeModule = module;
		detailsOpen = true;
	}

	// Chaque bascule soumet directement le formulaire complet, sans bouton.
	async function toggleFlag(key: FlagKey, checked: boolean) {
		flags[key] = checked;
		await tick();
		formEl.requestSubmit();
	}

	$effect(() => {
		if (form?.success) toast.success('Modules mis à jour');
		else if (form?.message) toast.error(form.message);
	});
</script>

<svelte:head>
	<title>Modules e-commerce — Admin</title>
</svelte:head>

<div class="px-6 space-y-6 max-w-5xl">
	<div>
		<h1 class="text-2xl font-semibold">Modules e-commerce</h1>
		<p class="text-sm text-muted-foreground">
			Un module désactivé n’apparaît nulle part côté boutique — pas seulement masqué, ses routes
			restent fermées.
		</p>
	</div>

	<form
		method="POST"
		bind:this={formEl}
		use:enhance={() => {
			pending = true;
			return async ({ update }) => {
				pending = false;
				await update();
			};
		}}
		class="space-y-6"
	>
		{#each modulesByCategory as group (group.category)}
			<div class="space-y-3">
				<h2 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
					{group.category}
				</h2>
				<div class="flex flex-wrap gap-4">
					{#each group.modules as module (module.key)}
						<div class="flex min-w-[240px] flex-1 basis-64 flex-col gap-3 rounded-lg border p-4">
							<div class="flex items-start justify-between gap-2">
								<Label for={module.key} class="text-sm font-medium">{module.label}</Label>
								<input type="hidden" name={module.key} value={flags[module.key] ? 'on' : 'off'} />
								<Switch
									id={module.key}
									checked={flags[module.key]}
									disabled={pending}
									onCheckedChange={(checked) => toggleFlag(module.key, checked)}
								/>
							</div>
							<p class="text-muted-foreground text-xs">{module.description}</p>
							<Button
								variant="link"
								class="h-auto self-start p-0 text-xs"
								onclick={() => openDetails(module)}
							>
								Comment ça marche ?
							</Button>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</form>
</div>

<Dialog.Root bind:open={detailsOpen}>
	<Dialog.Content>
		{#if activeModule}
			<Dialog.Header>
				<Dialog.Title>{activeModule.label}</Dialog.Title>
				<Dialog.Description>{activeModule.details}</Dialog.Description>
			</Dialog.Header>
		{/if}
	</Dialog.Content>
</Dialog.Root>
