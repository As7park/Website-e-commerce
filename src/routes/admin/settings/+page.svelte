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
		| 'flashSaleEnabled';

	type ModuleInfo = { key: FlagKey; label: string; description: string; details: string };

	const MODULES: ModuleInfo[] = [
		{
			key: 'wishlistEnabled',
			label: 'Liste d’envies',
			description:
				'Un cœur sur chaque fiche produit pour enregistrer un article à retrouver plus tard, visible depuis le compte client.',
			details:
				"Le client clique sur l'icône cœur d'une fiche produit (connecté obligatoire) ; l'article rejoint sa liste, consultable depuis son espace « Mes favoris ». Un même produit ne peut être ajouté qu'une fois par compte. Aucune action admin n'est nécessaire une fois le module activé — rien à configurer ni à modérer côté back-office."
		},
		{
			key: 'crossSellEnabled',
			label: 'Ventes croisées',
			description:
				'Bloc « Vous aimerez aussi » sur la fiche produit, basé sur la catégorie de l’article consulté.',
			details:
				"Sur chaque fiche produit s'affiche un bloc « Vous aimerez aussi » avec quelques produits de la même catégorie. La sélection est entièrement automatique (catégorie du produit consulté) : aucune association manuelle à saisir, rien à gérer une fois le module activé."
		},
		{
			key: 'returnsEnabled',
			label: 'Espace retour / SAV',
			description:
				'Permet à un client de déclarer un retour depuis l’historique de ses commandes plutôt que par le formulaire de contact générique.',
			details:
				"Depuis « Mes commandes », le client déclare un retour sur une commande déjà payée en indiquant un motif. La demande apparaît dans /admin/returns où l'admin l'approuve (remboursement Stripe ou crédit sous forme de carte cadeau) ou la refuse. Une étiquette de retour Sendcloud est générée automatiquement à l'approbation, sans bloquer le remboursement si elle échoue."
		},
		{
			key: 'savedPaymentsEnabled',
			label: 'Moyen de paiement enregistré',
			description:
				'Carte Stripe mémorisée pour accélérer un prochain achat, sans ressaisie au tunnel de commande.',
			details:
				"Au tunnel de commande, le client peut cocher « Mémoriser cette carte » : elle devient réutilisable en un clic lors d'un prochain achat. Gérable depuis son espace client (suppression possible). Aucune donnée de carte bancaire ne transite ni n'est stockée côté serveur — uniquement chez Stripe, seules les métadonnées d'affichage (marque, 4 derniers chiffres) sont conservées en base."
		},
		{
			key: 'loyaltyEnabled',
			label: 'Palier de fidélité',
			description:
				'Code promo automatique après un nombre de commandes payées, sur le moteur de codes promo déjà existant.',
			details:
				"Un code promo (créé et configuré depuis /admin/promo avec un seuil de commandes) est accordé automatiquement par e-mail dès qu'un client atteint ce nombre de commandes payées. L'envoi n'a jamais lieu deux fois pour le même palier, même si le paiement déclenche l'évènement plusieurs fois."
		},
		{
			key: 'giftCardsEnabled',
			label: 'Cartes cadeaux',
			description:
				'Champ dédié au tunnel de commande pour appliquer une carte cadeau (solde décroissant), en plus d’un éventuel code promo. Émission depuis /admin/gift-cards.',
			details:
				"Le tunnel de commande affiche un champ pour saisir un code de carte cadeau à solde décroissant, cumulable avec un code promo. Les cartes s'émettent depuis /admin/gift-cards (montant initial, destinataire, date d'expiration) : le client reçoit le code par e-mail et l'utilise en une ou plusieurs fois jusqu'à épuisement du solde."
		},
		{
			key: 'productQnaEnabled',
			label: 'Questions & réponses produit',
			description:
				'Formulaire de question sur la fiche produit. Une question reste invisible du public tant qu’un admin n’y a pas répondu depuis /admin/products/questions.',
			details:
				"Un client pose une question libre sur une fiche produit. Elle reste invisible du public tant qu'un admin n'y a pas répondu depuis /admin/products/questions — pas de file d'attente publique ni de question sans réponse affichée aux visiteurs."
		},
		{
			key: 'cartRecoveryEnabled',
			label: 'Relance panier abandonné',
			description:
				'Envoie un e-mail avec un code promo dégressif (10% puis 15%) aux clients qui laissent une commande en attente 1h puis 24h, sur le moteur de codes promo déjà existant.',
			details:
				"Un client qui laisse une commande en attente reçoit un e-mail de relance avec un code promo dégressif : 10% après 1h, puis 15% après 24h si la première relance n'a pas suffi. Le lien renvoie vers /checkout, où son panier est déjà rattaché automatiquement — aucun lien ni jeton spécial à gérer."
		},
		{
			key: 'flashSaleEnabled',
			label: 'Vente flash',
			description:
				'Bandeau et compte à rebours vitrine sur les fiches produit et le catalogue, tant que la date de fin de vente flash du produit est dans le futur.',
			details:
				"Chaque produit peut recevoir une date de fin de vente flash depuis /admin/products. Tant que ce module est actif et que la date est dans le futur, un badge (catalogue) et un bandeau avec compte à rebours (fiche produit) s'affichent automatiquement. Se combine avec le prix barré (compareAtPrice) mais fonctionne aussi seul."
		}
	];

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
		class="flex flex-wrap gap-4"
	>
		{#each MODULES as module (module.key)}
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
