<script lang="ts">
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { resetCart } from '$lib/store/Data/cartStore';

	let { data, children } = $props();

	let items = $derived(
		[
			{ href: '/auth/settings', label: 'Mon compte', show: true },
			{ href: '/auth/settings/address', label: 'Adresses', show: data.accountNav.isClient },
			{
				href: '/auth/settings/factures',
				label: 'Commandes & factures',
				show: data.accountNav.isClient
			},
			{
				href: '/auth/settings/wishlist',
				label: "Liste d'envies",
				show: data.accountNav.isClient && data.accountNav.wishlistEnabled
			},
			{
				href: '/auth/settings/returns',
				label: 'Retours',
				show: data.accountNav.isClient && data.accountNav.returnsEnabled
			},
			{
				href: '/auth/settings/saved-payments',
				label: 'Moyens de paiement',
				show: data.accountNav.isClient && data.accountNav.savedPaymentsEnabled
			},
			{
				href: '/auth/settings/referral',
				label: 'Parrainage',
				show: data.accountNav.isClient && data.accountNav.referralEnabled
			},
			{ href: '/auth/settings/donnees', label: 'Mes données', show: data.accountNav.isClient }
		].filter((item) => item.show)
	);

	function isActive(href: string, pathname: string) {
		return href === '/auth/settings' ? pathname === href : pathname.startsWith(href);
	}

	// Même comportement que la déconnexion depuis le tiroir panier.
	const enhanceSignOut: SubmitFunction = () => {
		return async ({ update }) => {
			resetCart();
			await update();
		};
	};

	let current = $derived(
		items.find((item) => item.href !== '/auth/settings' && isActive(item.href, $page.url.pathname))
	);
</script>

<nav class="shop-breadcrumb" aria-label="Fil d'Ariane">
	<a href="/">Accueil</a> /
	{#if current}
		<a href="/auth/settings">Mon compte</a> / {current.label}
	{:else}
		Mon compte
	{/if}
</nav>

<main class="shop-container shop-page">
	<div class="shop-account-layout">
		<nav class="shop-account-nav" aria-label="Espace client">
			<ul>
				{#each items as item (item.href)}
					<li>
						<a
							href={item.href}
							class:shop-active={isActive(item.href, $page.url.pathname)}
							aria-current={isActive(item.href, $page.url.pathname) ? 'page' : undefined}
							>{item.label}</a
						>
					</li>
				{/each}
				<li>
					<form method="post" action="/auth?/signout" use:enhance={enhanceSignOut}>
						<button type="submit" class="shop-account-signout">Se déconnecter</button>
					</form>
				</li>
			</ul>
		</nav>
		<section>
			{@render children()}
		</section>
	</div>
</main>
