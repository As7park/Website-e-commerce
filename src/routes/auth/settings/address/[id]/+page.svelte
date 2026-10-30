<script lang="ts">
	import { untrack } from 'svelte';
	import * as Form from '#shadcn/form';
	import { Button } from '#shadcn/button';
	import { Input } from '#shadcn/input';
	import { toast } from 'svelte-sonner';
	import AddressAutocomplete from '#lib/components/addresses/AddressAutocomplete.svelte';
	import type { AddressSuggestion } from '#lib/addresses/types';

	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { RETRY_FRIENDLY_FORM } from '#lib/forms/superformOptions';

	import { goto } from '$app/navigation';
	import { updateAddressSchema } from '#lib/schema/addresses/addressSchema.js';

	let { data } = $props();

	//console.log(data);

	const updateAddress = superForm(
		untrack(() => data.IupdateAddressSchema),
		{
			validators: zodClient(updateAddressSchema),
			id: 'updateAddress',
			...RETRY_FRIENDLY_FORM
		}
	);

	const {
		form: updateAddressData,
		enhance: updateAddressEnhance,
		message: updateAddressMessage
	} = updateAddress;

	$effect(() => {
		$updateAddressData.id = data.IupdateAddressSchema?.data.id;
	});

	function handleAddressSelect(suggestion: AddressSuggestion) {
		$updateAddressData.street_number = suggestion.street_number;
		$updateAddressData.street = suggestion.street;
		$updateAddressData.city = suggestion.city;
		$updateAddressData.county = suggestion.county;
		$updateAddressData.state = suggestion.state;
		$updateAddressData.state_code = suggestion.state_code;
		$updateAddressData.zip = suggestion.zip;
		$updateAddressData.country = suggestion.country;
		$updateAddressData.country_code = suggestion.country_code;
		$updateAddressData.stateLetter = suggestion.stateLetter;
		$updateAddressData.ISO_3166_1_alpha_3 = suggestion.ISO_3166_1_alpha_3;
	}

	$effect(() => {
		//console.log($updateAddressMessage);

		if ($updateAddressMessage === 'Address updated successfully') {
			toast.success($updateAddressMessage);
			setTimeout(() => goto('/auth/settings/address'), 0);
		}
	});
</script>

<header class="shop-page-head">
	<h1 class="shop-page-title">Modifier l’adresse</h1>
</header>

<div class="shop-panel">
	<div class="mb-6">
		<AddressAutocomplete onSelect={handleAddressSelect} />
	</div>

	<form
		method="POST"
		action="?/updateAddress"
		use:updateAddressEnhance
		class="grid gap-4 sm:grid-cols-2"
	>
		<!-- Prénom -->
		<Form.Field name="first_name" form={updateAddress}>
			<Form.Control>
				{#snippet children({ props })}
					<Form.Label>Prénom</Form.Label>
					<Input
						{...props}
						name="first_name"
						type="text"
						bind:value={$updateAddressData.first_name}
					/>
				{/snippet}
			</Form.Control>
			<Form.FieldErrors />
		</Form.Field>

		<!-- Nom -->
		<Form.Field name="last_name" form={updateAddress}>
			<Form.Control>
				{#snippet children({ props })}
					<Form.Label>Nom</Form.Label>
					<Input
						{...props}
						name="last_name"
						type="text"
						bind:value={$updateAddressData.last_name}
					/>
				{/snippet}
			</Form.Control>
			<Form.FieldErrors />
		</Form.Field>

		<!-- Téléphone -->
		<Form.Field name="phone" form={updateAddress}>
			<Form.Control>
				{#snippet children({ props })}
					<Form.Label>Téléphone</Form.Label>
					<Input {...props} name="phone" type="tel" bind:value={$updateAddressData.phone} />
				{/snippet}
			</Form.Control>
			<Form.FieldErrors />
		</Form.Field>

		<!-- Entreprise -->
		<Form.Field name="company" form={updateAddress}>
			<Form.Control>
				{#snippet children({ props })}
					<Form.Label>Entreprise</Form.Label>
					<Input {...props} name="company" type="text" bind:value={$updateAddressData.company} />
				{/snippet}
			</Form.Control>
			<Form.FieldErrors />
		</Form.Field>

		<!-- Numéro de rue -->
		<Form.Field name="street_number" form={updateAddress}>
			<Form.Control>
				{#snippet children({ props })}
					<Form.Label>Numéro</Form.Label>
					<Input
						{...props}
						name="street_number"
						type="text"
						bind:value={$updateAddressData.street_number}
					/>
				{/snippet}
			</Form.Control>
			<Form.FieldErrors />
		</Form.Field>

		<!-- Rue -->
		<Form.Field name="street" form={updateAddress}>
			<Form.Control>
				{#snippet children({ props })}
					<Form.Label>Rue</Form.Label>
					<Input {...props} name="street" type="text" bind:value={$updateAddressData.street} />
				{/snippet}
			</Form.Control>
			<Form.FieldErrors />
		</Form.Field>

		<!-- Ville -->
		<Form.Field name="city" form={updateAddress}>
			<Form.Control>
				{#snippet children({ props })}
					<Form.Label>Ville</Form.Label>
					<Input {...props} name="city" type="text" bind:value={$updateAddressData.city} />
				{/snippet}
			</Form.Control>
			<Form.FieldErrors />
		</Form.Field>

		<!-- Code postal -->
		<Form.Field name="zip" form={updateAddress}>
			<Form.Control>
				{#snippet children({ props })}
					<Form.Label>Code Postal</Form.Label>
					<Input {...props} name="zip" type="text" bind:value={$updateAddressData.zip} />
				{/snippet}
			</Form.Control>
			<Form.FieldErrors />
		</Form.Field>

		<!-- Pays -->
		<Form.Field name="country" form={updateAddress}>
			<Form.Control>
				{#snippet children({ props })}
					<Form.Label>Pays</Form.Label>
					<Input {...props} name="country" type="text" bind:value={$updateAddressData.country} />
				{/snippet}
			</Form.Control>
			<Form.FieldErrors />
		</Form.Field>

		<input type="hidden" name="id" bind:value={$updateAddressData.id} />
		{#each Object.keys($updateAddressData) as key (key)}
			<input
				type="hidden"
				name={key}
				value={$updateAddressData[key as keyof typeof $updateAddressData] ?? ''}
			/>
		{/each}
		<div class="mt-2 flex gap-3 sm:col-span-2">
			<Button type="submit">Enregistrer</Button>
			<Button href="/auth/settings/address" variant="outline">Annuler</Button>
		</div>
	</form>
</div>
