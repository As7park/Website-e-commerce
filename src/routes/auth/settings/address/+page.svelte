<!-- File: AddressCards.svelte -->
<script lang="ts">
	import { untrack } from 'svelte';
	/* ───────────────────────────── Imports ───────────────────────────── */
	import { Button } from '$shadcn/button/index.js'; // Shadcn button
	import Plus from 'lucide-svelte/icons/plus';
	import Pencil from 'lucide-svelte/icons/pencil';
	import Trash from 'lucide-svelte/icons/trash';

	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { deleteAddressSchema } from '$lib/schema/addresses/addressSchema.js';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';

	/* ───────────────────────────── Props ─────────────────────────────── */
	let { data } = $props(); // addresses from parent load()
	//console.log('[AddressPage] Data loaded:', data);

	/* ───────────────────────────── Forms ─────────────────────────────── */
	const deleteAddress = superForm(
		untrack(() => data?.IdeleteAddressSchema ?? {}),
		{
			validators: zodClient(deleteAddressSchema),
			id: 'deleteAddress'
		}
	);

	const {
		form: deleteAddressData,
		enhance: deleteAddressEnhance,
		message: deleteAddressMessage
	} = deleteAddress;

	/* ───────────────────────────── Effects ───────────────────────────── */
	$effect(() => {
		if ($deleteAddressMessage) {
			//console.log(`[AddressPage] Form message: ${$deleteAddressMessage}`);
			toast($deleteAddressMessage);
		}
	});

	/* ───────────────────────────── Helpers ───────────────────────────── */
	function edit(id: string) {
		//console.log(`[AddressPage] Navigating to edit address ID: ${id}`);
		goto(`/auth/settings/address/${id}`);
	}
	function add() {
		//console.log('[AddressPage] Navigating to create new address.');
		goto('/auth/settings/address/create');
	}
</script>

<header class="shop-page-head flex flex-wrap items-end justify-between gap-4">
	<div>
		<h1 class="shop-page-title">Mes adresses</h1>
		<p class="shop-page-lead">Vos adresses de livraison et de facturation.</p>
	</div>
	<Button onclick={add} class="inline-flex items-center gap-2">
		<Plus size="16" /> Ajouter une adresse
	</Button>
</header>

{#if (data.address ?? []).length === 0}
	<div class="shop-panel shop-muted">Aucune adresse enregistrée pour le moment.</div>
{:else}
	<div class="shop-account-grid">
		{#each data.address ?? [] as address (address.id)}
			<div class="shop-panel flex flex-col">
				<h2 class="shop-panel-title">{address.first_name} {address.last_name}</h2>
				<ul class="flex-1 space-y-1 text-sm">
					{#if address.company}<li>{address.company}</li>{/if}
					<li>{address.street_number} {address.street}</li>
					<li>{address.zip} {address.city}</li>
					{#if address.state}<li>{address.state}</li>{/if}
					<li>{address.country}</li>
					{#if address.phone}<li class="shop-muted">{address.phone}</li>{/if}
				</ul>
				<div class="mt-5 flex items-center gap-4 border-t border-border pt-4 text-sm">
					<button
						type="button"
						class="inline-flex items-center gap-1 shop-link"
						onclick={() => edit(address.id)}
					>
						<Pencil size="14" /> Modifier
					</button>
					<form method="POST" action="?/deleteAddress" use:deleteAddressEnhance class="inline-flex">
						<input type="hidden" name="id" value={address.id} />
						<button
							type="submit"
							class="inline-flex items-center gap-1 text-destructive hover:underline"
							onclick={() => ($deleteAddressData.id = address.id)}
						>
							<Trash size="14" /> Supprimer
						</button>
					</form>
				</div>
			</div>
		{/each}
	</div>
{/if}
