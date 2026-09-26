<script lang="ts">
	import { untrack } from 'svelte';
	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { createAddressSchema } from '$lib/schema/addresses/addressSchema.js';

	import * as Form from '$shadcn/form';
	import { Button } from '$shadcn/button';
	import { Input } from '$shadcn/input';
	import { toast } from 'svelte-sonner';
	import AddressAutocomplete from '$lib/components/addresses/AddressAutocomplete.svelte';
	import type { AddressSuggestion } from '$lib/addresses/types';

	import { goto } from '$app/navigation';

	let { data } = $props();

	const createAddress = superForm(
		untrack(() => data.IcreateAddressSchema),
		{
			validators: zodClient(createAddressSchema),
			id: 'createAddress'
		}
	);

	const {
		form: createAddressData,
		enhance: createAddressEnhance,
		message: createAddressMessage
	} = createAddress;

	$effect(() => {
		if ($createAddressMessage === 'Address created successfully') {
			goto('/auth/settings/address');
			toast($createAddressMessage);
		}
	});

	$effect(() => {
		$createAddressData.userId = data.userId;
	});

	$effect(() => {
		//console.log($createAddressData);
	});

	function handleAddressSelect(suggestion: AddressSuggestion) {
		$createAddressData.street_number = suggestion.street_number;
		$createAddressData.street = suggestion.street;
		$createAddressData.city = suggestion.city;
		$createAddressData.county = suggestion.county;
		$createAddressData.state = suggestion.state;
		$createAddressData.state_code = suggestion.state_code;
		$createAddressData.zip = suggestion.zip;
		$createAddressData.country = suggestion.country;
		$createAddressData.country_code = suggestion.country_code;
		$createAddressData.stateLetter = suggestion.stateLetter;
		$createAddressData.ISO_3166_1_alpha_3 = suggestion.ISO_3166_1_alpha_3;
	}
</script>

<header class="shop-page-head">
	<h1 class="shop-page-title">Nouvelle adresse</h1>
	<p class="shop-page-lead">Commencez à taper votre adresse pour la compléter automatiquement.</p>
</header>

<div class="shop-panel">
	<div>
		<div class="mb-6">
			<AddressAutocomplete onSelect={handleAddressSelect} />
		</div>

		<form
			method="POST"
			action={`?/createAddress${data.redirectTarget ? `&redirect=${data.redirectTarget}` : ''}${data.addressTarget ? `&target=${data.addressTarget}` : ''}`}
			use:createAddressEnhance
			class="grid gap-4 sm:grid-cols-2"
		>
			<!-- Prénom -->
			<Form.Field name="first_name" form={createAddress}>
				<Form.Control>
					<Form.Label>Prénom</Form.Label>
					<Input name="first_name" type="text" bind:value={$createAddressData.first_name} />
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<!-- Nom -->
			<Form.Field name="last_name" form={createAddress}>
				<Form.Control>
					<Form.Label>Nom</Form.Label>
					<Input name="last_name" type="text" bind:value={$createAddressData.last_name} />
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<!-- Téléphone -->
			<Form.Field name="phone" form={createAddress}>
				<Form.Control>
					<Form.Label>Téléphone</Form.Label>
					<Input name="phone" type="tel" bind:value={$createAddressData.phone} />
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<!-- Entreprise -->
			<Form.Field name="company" form={createAddress}>
				<Form.Control>
					<Form.Label>Entreprise</Form.Label>
					<Input name="company" type="text" bind:value={$createAddressData.company} />
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<!-- Numéro de rue -->
			<Form.Field name="street_number" form={createAddress}>
				<Form.Control>
					<Form.Label>Numéro</Form.Label>
					<Input name="street_number" type="text" bind:value={$createAddressData.street_number} />
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<!-- Rue -->
			<Form.Field name="street" form={createAddress}>
				<Form.Control>
					<Form.Label>Rue</Form.Label>
					<Input name="street" type="text" bind:value={$createAddressData.street} />
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<!-- Ville -->
			<Form.Field name="city" form={createAddress}>
				<Form.Control>
					<Form.Label>Ville</Form.Label>
					<Input name="city" type="text" bind:value={$createAddressData.city} />
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<!-- Code postal -->
			<Form.Field name="zip" form={createAddress}>
				<Form.Control>
					<Form.Label>Code Postal</Form.Label>
					<Input name="zip" type="text" bind:value={$createAddressData.zip} />
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<!-- Pays -->
			<Form.Field name="country" form={createAddress}>
				<Form.Control>
					<Form.Label>Pays</Form.Label>
					<Input name="country" type="text" bind:value={$createAddressData.country} />
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<input type="hidden" name="userId" bind:value={$createAddressData.userId} />
			<input type="hidden" name="county" bind:value={$createAddressData.county} />
			<input type="hidden" name="state" bind:value={$createAddressData.state} />
			<input type="hidden" name="stateLetter" bind:value={$createAddressData.stateLetter} />
			<input type="hidden" name="state_code" bind:value={$createAddressData.state_code} />
			<input type="hidden" name="country_code" bind:value={$createAddressData.country_code} />
			<input
				type="hidden"
				name="ISO_3166_1_alpha_3"
				bind:value={$createAddressData.ISO_3166_1_alpha_3}
			/>

			<div class="mt-2 sm:col-span-2">
				<Button type="submit">Enregistrer l’adresse</Button>
			</div>
		</form>
	</div>
</div>
