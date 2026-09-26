<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$shadcn/button';
	import ShopPage from '$lib/components/shop/ShopPage.svelte';
	let { data } = $props();
</script>

<!-- `noindex` posé une fois pour toutes par src/routes/auth/+layout.svelte. -->

<ShopPage
	title={`Bonjour, ${data.user.username} !`}
	lead="Vous êtes connecté·e."
	crumbs={[{ label: 'Mon compte' }]}
	width="narrow"
>
	<div class="shop-panel shop-stack">
		<Button href="/auth/settings" class="w-full">Mon compte</Button>
		<!-- ADMIN-PLUGIN ▼ lien vers le back-office, visible aux seuls administrateurs. -->
		{#if data.user.role === 'ADMIN'}
			<Button href="/admin" variant="outline" class="w-full">Dashboard</Button>
		{/if}
		<!-- ADMIN-PLUGIN ▲ -->
		<form method="post" action="?/signout" use:enhance>
			<Button type="submit" variant="outline" class="w-full">Se déconnecter</Button>
		</form>
	</div>
</ShopPage>
