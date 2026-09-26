<script lang="ts">
	import { Button } from '$shadcn/button';
	import { AlertCircle } from 'lucide-svelte';
	import ShopPage from '$lib/components/shop/ShopPage.svelte';

	let { data } = $props();
</script>

<ShopPage
	title="Code de récupération"
	lead="Conservez ce code en lieu sûr : il vous permettra d'accéder à votre compte si vous perdez votre application d'authentification."
	crumbs={[{ label: 'Mon compte', href: '/auth/settings' }, { label: 'Code de récupération' }]}
	width="narrow"
>
	<div class="shop-panel">
		<p class="shop-alert mb-4 flex items-center gap-2">
			<AlertCircle size={16} /> Ce code ne sera plus affiché.
		</p>
		<div class="mb-6 border border-border p-4">
			<p class="font-mono text-center text-lg tracking-widest">{data.recoveryCode}</p>
		</div>
		<Button href="/auth" class="w-full">Continuer</Button>
	</div>
</ShopPage>
