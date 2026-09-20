<script lang="ts">
	/* ------------------------------------------------------------------
	   IMPORTS
	------------------------------------------------------------------ */
	import SmoothScrollBar from './../smoothScrollBar/SmoothScrollBar.svelte';
	import '@fontsource-variable/open-sans';
	import '@fontsource-variable/raleway';

	import {
		cart,
		addToCart,
		removeFromCart,
		updateCartItemQuantity,
		resetCart,
		getCustomCanPrice,
		type OrderItem
	} from '$lib/store/Data/cartStore';
	import { optimizedImageUrl } from '$lib/utils/cloudinaryUrl';
	import { Badge } from '$shadcn/badge';
	import Button from '$shadcn/button/button.svelte';
	import * as Sheet from '$shadcn/sheet/index.js';
	import { Trash, ShoppingCart } from 'lucide-svelte';
	import QuantityInput from '../QuantityInput.svelte';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';

	/*  👉 le store 'mode'  */
	import { mode as modeStore } from 'mode-watcher';

	/* ------------------------------------------------------------------
	   FONCTIONS UTILITAIRES
	------------------------------------------------------------------ */

	/* ------------------------------------------------------------------
	   PROPS & ÉTAT
	------------------------------------------------------------------ */
	// SHOP-DESIGN : même composant, deux thèmes. `shop` sort le tiroir de son
	// portail par défaut (`document.body`) vers `#shop-scope` — sinon les
	// variables CSS `--shop-*` (définies sur ce conteneur, jamais sur `:root`)
	// ne seraient pas héritées par le contenu porté, qui resterait sans style.
	let { data, variant = 'default' }: { data: any; variant?: 'default' | 'shop' } = $props();

	let user = $derived(data.user ?? null);
	let sidebarOpen = $state(false);

	/*  Valeur dérivée et réactive du store mode  */
	let currentMode = $derived(modeStore); // ✅ pas de $

	/*  true si aucune personnalisation dans le panier  */
	let isNativeOrder = $derived(
		$cart.items.every((i) => !i.custom || (Array.isArray(i.custom) && i.custom.length === 0))
	);

	// Calculer le total des quantités pour les commandes non-personnalisées
	let totalNonCustomQuantity = $derived(
		$cart.items
			.filter((item) => !item.custom || (Array.isArray(item.custom) && item.custom.length === 0))
			.reduce((acc, item) => acc + item.quantity, 0)
	);

	// Borne haute du champ libre : stock dispo, et pour le non-custom, le
	// reliquat sous le plafond global de 72 unités (pas de plafond en custom).
	function maxQuantityFor(item: OrderItem, isCustom: boolean): number {
		const stockLimit = item.variant?.stock ?? item.product.stock;
		if (isCustom) return stockLimit;

		const otherItemsQuantity = totalNonCustomQuantity - item.quantity;
		return Math.max(0, Math.min(stockLimit, 72 - otherItemsQuantity));
	}

	/* ------------------------------------------------------------------
	   BUNDLE-PLUGIN : suggestions « souvent achetés ensemble »
	------------------------------------------------------------------ */
	type BundleSuggestion = {
		id: string;
		name: string;
		slug: string;
		price: number;
		images: string[];
		stock: number;
	};

	let bundleSuggestions = $state<BundleSuggestion[]>([]);

	$effect(() => {
		const productIds = $cart.items.map((item) => item.product.id);
		if (!data.frequentlyBoughtTogetherEnabled || productIds.length === 0) {
			bundleSuggestions = [];
			return;
		}

		const controller = new AbortController();
		fetch(`/api/bundles?productIds=${encodeURIComponent(productIds.join(','))}`, {
			signal: controller.signal
		})
			.then((res) => (res.ok ? res.json() : { suggestions: [] }))
			.then((body) => {
				bundleSuggestions = body.suggestions ?? [];
			})
			.catch(() => {
				// Silencieux : une suggestion manquante n'est jamais bloquante.
			});

		return () => controller.abort();
	});

	function addSuggestionToCart(suggestion: BundleSuggestion) {
		addToCart({
			id: crypto.randomUUID(),
			product: {
				id: suggestion.id,
				name: suggestion.name,
				price: suggestion.price,
				images: suggestion.images[0] ?? '',
				stock: suggestion.stock
			},
			quantity: 1,
			price: suggestion.price
		});
	}

	/* ------------------------------------------------------------------
	   ACTIONS
	------------------------------------------------------------------ */
	function handleRemoveFromCart(id: string, customId?: string, variantId?: string) {
		removeFromCart(id, customId, variantId);
	}

	function changeQuantity(id: string, qte: number, customId?: string, variantId?: string) {
		updateCartItemQuantity(id, qte, customId, variantId);
	}

	/**
	 * Déconnexion depuis le panier.
	 *
	 * AUTH-PLUGIN : POST vers l'action `?/signout` de `/auth` (formulaire, pas
	 * `fetch`) pour que la protection CSRF de SvelteKit laisse passer la requête.
	 * Le panier local est vidé avant la redirection vers l'accueil.
	 *
	 * `update()` est dans un `finally` : une exception dans `resetCart()` ne doit
	 * jamais empêcher la navigation post-déconnexion (sinon la session est bien
	 * invalidée côté serveur mais l'utilisateur reste planté sur la page).
	 */
	const enhanceSignOut: SubmitFunction = () => {
		return async ({ update }) => {
			try {
				resetCart();
			} finally {
				sidebarOpen = false;
				await update();
			}
		};
	};
</script>

{#snippet cartTrigger(props: Record<string, unknown>)}
	{#if variant === 'shop'}
		<button {...props} class="shop-icon-ph shop-cart-link" aria-label="Panier">
			<ShoppingCart size={13} />
			{#if ($cart?.items?.length ?? 0) > 0}
				<span class="shop-cart-count">{$cart.items.length}</span>
			{/if}
		</button>
	{:else}
		<button
			{...props}
			class="relative m-5 h-8 w-8 ccc"
			class:text-black={currentMode.current === 'light'}
			class:text-white={currentMode.current === 'dark'}
		>
			<ShoppingCart class="w-8 h-8 absolute right-0 top-0 stroke-current transition-colors" />
			<Badge class="bulletCart font-bold absolute z-10 left-0 bottom-0">
				{$cart?.items?.length ?? 0}
			</Badge>
		</button>
	{/if}
{/snippet}

{#if variant === 'shop'}
	<Sheet.Root bind:open={sidebarOpen}>
		<Sheet.Trigger>
			{#snippet child({ props })}
				{@render cartTrigger(props)}
			{/snippet}
		</Sheet.Trigger>

		<Sheet.Content class="p-0 min-w-fit shop-cart-sheet" portalProps={{ to: '#shop-scope' }}>
			<SmoothScrollBar>
				<div class="p-4">
					<h2 class="text-2xl font-bold mb-4">Votre panier</h2>

					{#if isNativeOrder}
						<p class="mb-4">
							Pour les commandes non-personnalisées, la quantité totale est limitée à 72 unités.
						</p>
					{/if}

					{#if $cart && $cart.items && $cart.items.length > 0}
						<div class="max-h-[500px] overflow-y-auto">
							{#each $cart.items as item (item.id)}
								{@const isCustomItem = Boolean(
									item.custom && Array.isArray(item.custom) && item.custom.length > 0
								)}
								<div class="p-4 border rounded-lg shadow-sm flex justify-between items-center mb-2">
									<img
										src={optimizedImageUrl(
											(item.custom &&
												Array.isArray(item.custom) &&
												item.custom.length > 0 &&
												item.custom[0].image) ||
												(Array.isArray(item.product.images)
													? item.product.images[0]
													: item.product.images) ||
												'',
											100
										)}
										alt={item.product.name}
										class="w-20 h-20 object-cover mr-5"
									/>

									<div class="flex-1 mx-4">
										<h3 class="text-lg font-semibold">
											{item.product.name}
											{#if item.variant}
												<span class="text-sm font-normal opacity-70">— {item.variant.label}</span>
											{/if}
											{#if item.custom && Array.isArray(item.custom) && item.custom.length > 0}
												<span class="text-sm font-normal opacity-70">Custom</span>
											{/if}
										</h3>
										<p class="opacity-80">
											{#if item.custom && Array.isArray(item.custom) && item.custom.length > 0}
												{getCustomCanPrice(item.quantity).toFixed(2)}€ l'unité
											{:else}
												{(item.variant?.price ?? item.product.price).toFixed(2)}€
											{/if}
										</p>

										<QuantityInput
											value={item.quantity}
											max={maxQuantityFor(item, isCustomItem)}
											onCommit={(v) =>
												changeQuantity(item.product.id, v, item.custom?.[0]?.id, item.variant?.id)}
										/>
										{#if !isCustomItem && totalNonCustomQuantity > 72}
											<p class="text-xs text-red-500 mt-1">
												Limite de 72 unités atteinte pour les commandes non-personnalisées
											</p>
										{/if}
									</div>
									<div class="flex flex-col items-end">
										<p class="text-lg font-semibold">
											{#if item.custom && Array.isArray(item.custom) && item.custom.length > 0}
												{(getCustomCanPrice(item.quantity) * item.quantity).toFixed(2)}€
											{:else}
												{(item.price * item.quantity).toFixed(2)}€
											{/if}
										</p>
										<button
											onclick={() =>
												handleRemoveFromCart(item.product.id, item.custom?.[0]?.id, item.variant?.id)}
											class="text-red-500 hover:text-red-400"
										>
											<Trash />
										</button>
									</div>
								</div>
							{/each}
						</div>

						<div class="mt-4 border-t pt-4 space-y-2">
							<div class="flex justify-between">
								<span>Subtotal :</span>
								<span>{($cart.subtotal ?? 0).toFixed(2)} €</span>
							</div>
							<div class="flex justify-between">
								<span>TVA (5,5 %) :</span>
								<span>{($cart.tax ?? 0).toFixed(2)} €</span>
							</div>
							<div class="flex justify-between font-semibold text-xl">
								<span>Total :</span>
								<span>{isFinite($cart.total) ? $cart.total.toFixed(2) : '0.00'} €</span>
							</div>
						</div>

						{#if bundleSuggestions.length > 0}
							<div class="mt-4 border-t pt-4">
								<h3 class="text-sm font-semibold mb-2">Souvent achetés ensemble</h3>
								{#each bundleSuggestions as suggestion (suggestion.id)}
									<div class="flex items-center justify-between gap-2 py-1">
										<div class="flex items-center gap-2 min-w-0">
											<img
												src={optimizedImageUrl(suggestion.images[0] ?? '', 60)}
												alt={suggestion.name}
												class="w-12 h-12 object-cover shrink-0"
											/>
											<div class="min-w-0">
												<p class="text-sm truncate">{suggestion.name}</p>
												<p class="text-xs opacity-70">{suggestion.price.toFixed(2)}€</p>
											</div>
										</div>
										<button
											type="button"
											class="shop-btn shop-btn-outline shrink-0"
											style="width:auto; height:auto; padding:6px 12px;"
											onclick={() => addSuggestionToCart(suggestion)}
										>
											Ajouter
										</button>
									</div>
								{/each}
								<p class="text-xs opacity-70 mt-1">
									Petite remise automatique appliquée au paiement si ces produits restent ensemble
									dans le panier.
								</p>
							</div>
						{/if}
					{:else}
						<p>Votre panier est vide.</p>
					{/if}

					{#if user}
						<div class="ccc" style="gap:8px; margin-top:16px;">
							<a
								href="/checkout"
								class="shop-btn shop-btn-block"
								onclick={() => (sidebarOpen = false)}
							>
								Checkout
							</a>
							<a
								href="/auth/settings"
								class="shop-btn shop-btn-outline shop-btn-block"
								onclick={() => (sidebarOpen = false)}
							>
								Mes paramètres
							</a>
							{#if user.role === 'ADMIN'}
								<a
									href="/admin"
									class="shop-btn shop-btn-outline shop-btn-block"
									onclick={() => (sidebarOpen = false)}
								>
									Dashboard
								</a>
							{/if}
							<form method="POST" action="/auth?/signout" use:enhance={enhanceSignOut}>
								<button type="submit" class="shop-btn shop-btn-outline shop-btn-block">
									Se déconnecter
								</button>
							</form>
						</div>
					{:else}
						<div class="text-center mt-4">
							<p class="mb-2">
								Veuillez vous
								<a href="/auth/login" onclick={() => (sidebarOpen = false)} class="underline"
									>connecter</a
								>
								ou
								<a href="/auth/signup" onclick={() => (sidebarOpen = false)} class="underline"
									>vous inscrire</a
								>
								pour finaliser votre commande.
							</p>
						</div>
					{/if}
				</div>
			</SmoothScrollBar>
		</Sheet.Content>
	</Sheet.Root>
{:else}
	<!-- ----------------------------------------------------------------- -->
	<!--  BOUTON PANIER                                                   -->
	<!-- ----------------------------------------------------------------- -->
	<div
		class="cartButton ccc relative h-[50px] w-[50px] rounded-[10px] border border-white bg-white/20"
	>
		<div class="absolute z-50 ccc">
			<Sheet.Root bind:open={sidebarOpen}>
				<Sheet.Trigger>
					{#snippet child({ props })}
						{@render cartTrigger(props)}
					{/snippet}
				</Sheet.Trigger>

				<!-- ----------------------------------------------------------------- -->
				<!--  CONTENU DU TIROIR                                                -->
				<!-- ----------------------------------------------------------------- -->
				<Sheet.Content class="p-0 min-w-fit">
					<SmoothScrollBar>
					<div class="p-4">
						<h2 class="text-2xl font-bold mb-4">Votre panier</h2>

						{#if isNativeOrder}
							<p class="mb-4">
								Pour les commandes non-personnalisées, la quantité totale est limitée à 72 unités.
							</p>
						{/if}

						{#if $cart && $cart.items && $cart.items.length > 0}
							<div class="max-h-[500px] overflow-y-auto">
								{#each $cart.items as item (item.id)}
									{@const isCustomItem = Boolean(
										item.custom && Array.isArray(item.custom) && item.custom.length > 0
									)}
									<div
										class="p-4 border rounded-lg shadow-sm flex justify-between items-center mb-2"
									>
										<img
											src={optimizedImageUrl(
												(item.custom &&
													Array.isArray(item.custom) &&
													item.custom.length > 0 &&
													item.custom[0].image) ||
													(Array.isArray(item.product.images)
														? item.product.images[0]
														: item.product.images) ||
													'',
												100
											)}
											alt={item.product.name}
											class="w-20 h-20 object-cover mr-5"
										/>

										<div class="flex-1 mx-4">
											<h3 class="text-lg font-semibold">
												{item.product.name}
												{#if item.variant}
													<span class="text-sm font-normal text-gray-500"
														>— {item.variant.label}</span
													>
												{/if}
												{#if item.custom && Array.isArray(item.custom) && item.custom.length > 0}
													<span class="text-sm font-normal text-gray-500">Custom</span>
												{/if}
											</h3>
											<p class="text-gray-600">
												{#if item.custom && Array.isArray(item.custom) && item.custom.length > 0}
													{getCustomCanPrice(item.quantity).toFixed(2)}€ l'unité
												{:else}
													{(item.variant?.price ?? item.product.price).toFixed(2)}€
												{/if}
											</p>

											<QuantityInput
												value={item.quantity}
												max={maxQuantityFor(item, isCustomItem)}
												onCommit={(v) =>
													changeQuantity(
														item.product.id,
														v,
														item.custom?.[0]?.id,
														item.variant?.id
													)}
											/>
											{#if !isCustomItem && totalNonCustomQuantity > 72}
												<p class="text-xs text-red-500 mt-1">
													Limite de 72 unités atteinte pour les commandes non-personnalisées
												</p>
											{/if}
										</div>
										<div class="flex flex-col items-end">
											<p class="text-lg font-semibold">
												{#if item.custom && Array.isArray(item.custom) && item.custom.length > 0}
													{(getCustomCanPrice(item.quantity) * item.quantity).toFixed(2)}€
												{:else}
													{(item.price * item.quantity).toFixed(2)}€
												{/if}
											</p>
											<button
												onclick={() =>
													handleRemoveFromCart(
														item.product.id,
														item.custom?.[0]?.id,
														item.variant?.id
													)}
												class="text-red-600 hover:text-red-800"
											>
												<Trash />
											</button>
										</div>
									</div>
								{/each}
							</div>

							<!-- ---------- RÉCAPITULATIF ---------------------------- -->
							<div class="mt-4 border-t pt-4 space-y-2">
								<div class="flex justify-between">
									<span>Subtotal :</span>
									<span>{($cart.subtotal ?? 0).toFixed(2)} €</span>
								</div>
								<div class="flex justify-between">
									<span>TVA (5,5 %) :</span>
									<span>{($cart.tax ?? 0).toFixed(2)} €</span>
								</div>
								<div class="flex justify-between font-semibold text-xl">
									<span>Total :</span>
									<span>{isFinite($cart.total) ? $cart.total.toFixed(2) : '0.00'} €</span>
								</div>
							</div>

							<!-- ---------- BUNDLE-PLUGIN : souvent achetés ensemble --- -->
							{#if bundleSuggestions.length > 0}
								<div class="mt-4 border-t pt-4">
									<h3 class="text-sm font-semibold mb-2">Souvent achetés ensemble</h3>
									{#each bundleSuggestions as suggestion (suggestion.id)}
										<div class="flex items-center justify-between gap-2 py-1">
											<div class="flex items-center gap-2 min-w-0">
												<img
													src={optimizedImageUrl(suggestion.images[0] ?? '', 60)}
													alt={suggestion.name}
													class="w-12 h-12 object-cover shrink-0"
												/>
												<div class="min-w-0">
													<p class="text-sm truncate">{suggestion.name}</p>
													<p class="text-xs text-gray-500">{suggestion.price.toFixed(2)}€</p>
												</div>
											</div>
											<Button
												type="button"
												variant="outline"
												class="shrink-0"
												onclick={() => addSuggestionToCart(suggestion)}
											>
												Ajouter
											</Button>
										</div>
									{/each}
									<p class="text-xs text-gray-500 mt-1">
										Petite remise automatique appliquée au paiement si ces produits restent ensemble
										dans le panier.
									</p>
								</div>
							{/if}
						{:else}
							<p>Votre panier est vide.</p>
						{/if}

						<!-- ---------- ACTIONS UTILISATEUR ------------------------ -->
						<!--
							AUTH-PLUGIN ▼ bloc compte : lien paramètres, accès admin, déconnexion,
							et invitation à se connecter avant paiement.
							Sans authentification, ne conserver que le bouton « Checkout ».
						-->
						{#if user}
							<div class="ccc">
								<!-- COMMERCE-PLUGIN -->
								<Button class="w-full m-2" href="/checkout" onclick={() => (sidebarOpen = false)}>
									Checkout
								</Button>
								<Button
									class="w-full m-2"
									href="/auth/settings"
									onclick={() => (sidebarOpen = false)}
								>
									Mes paramètres
								</Button>

								<!-- ADMIN-PLUGIN ▼ lien vers le back-office, visible aux seuls administrateurs. -->
								{#if user.role === 'ADMIN'}
									<Button class="w-full m-2" href="/admin" onclick={() => (sidebarOpen = false)}>
										Dashboard
									</Button>
								{/if}
								<!-- ADMIN-PLUGIN ▲ -->

								<form method="POST" action="/auth?/signout" use:enhance={enhanceSignOut}>
									<Button type="submit" class="w-full m-2" variant="destructive">
										Se déconnecter
									</Button>
								</form>
							</div>
						{:else}
							<div class="text-center mt-4">
								<p class="mb-2">
									Veuillez vous
									<a
										href="/auth/login"
										onclick={() => (sidebarOpen = false)}
										class="text-blue-500 underline">connecter</a
									>
									ou
									<a
										href="/auth/signup"
										onclick={() => (sidebarOpen = false)}
										class="text-blue-500 underline">vous inscrire</a
									>
									pour finaliser votre commande.
								</p>
							</div>
						{/if}
						<!-- AUTH-PLUGIN ▲ -->
					</div>
				</SmoothScrollBar>
			</Sheet.Content>
		</Sheet.Root>
	</div>
</div>
{/if}
