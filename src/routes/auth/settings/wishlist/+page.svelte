<script lang="ts">
	import { untrack } from 'svelte';
	import * as Card from '$shadcn/card';
	import { Button } from '$shadcn/button';
	import { optimizedImageUrl } from '$lib/utils/cloudinaryUrl';
	import Heart from 'lucide-svelte/icons/heart';

	let { data } = $props();
	let products = $state(untrack(() => [...data.products]));

	async function remove(productId: string) {
		const res = await fetch('/api/wishlist', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ productId })
		});
		if (res.ok) {
			products = products.filter((p) => p.id !== productId);
		}
	}
</script>

<svelte:head>
	<title>Ma liste d'envies</title>
</svelte:head>

<div class="mx-auto max-w-[960px] px-6 pt-10 pb-12">
	<p class="mb-6">
		<a href="/auth/settings" class="text-foreground">← Mon compte</a>
	</p>
	<h1 class="mb-6 text-2xl font-semibold">Ma liste d'envies</h1>

	{#if products.length === 0}
		<p class="text-muted-foreground">
			Aucun produit enregistré pour l'instant. Le cœur sur une fiche produit l'ajoute ici.
		</p>
	{:else}
		<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
			{#each products as product (product.id)}
				<Card.Root class="min-h-[280px] gap-0 overflow-hidden py-0">
					<a href="/products/{product.slug}" class="block">
						<div class="h-40 w-full shrink-0 overflow-hidden">
							{#if product.images[0]}
								<img
									src={optimizedImageUrl(product.images[0], 400)}
									alt={product.name}
									loading="lazy"
									class="h-full w-full object-cover"
								/>
							{:else}
								<div class="h-full w-full bg-muted" aria-hidden="true"></div>
							{/if}
						</div>
					</a>
					<Card.Content class="flex flex-1 flex-col p-4">
						<a href="/products/{product.slug}">
							<Card.Title class="mb-2 text-[0.95rem] font-medium">
								<h2>{product.name}</h2>
							</Card.Title>
						</a>
						<p class="mb-3 text-base">{product.price.toFixed(2)} €</p>
						<Button variant="outline" size="sm" onclick={() => remove(product.id)}>
							<Heart class="mr-2 size-4 fill-current" />
							Retirer
						</Button>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	{/if}
</div>
