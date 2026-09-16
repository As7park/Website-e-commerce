<script lang="ts">
	import * as Form from '$shadcn/form';
	import { Button } from '$shadcn/button';
	import { Input } from '$shadcn/input';
	import * as Select from '$shadcn/select';
	import { toast } from 'svelte-sonner';
	import { Card } from '$shadcn/card';
	import ScrollArea from '$shadcn/scroll-area/scroll-area.svelte';

	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';

	import { goto } from '$app/navigation';
	import { updateAddressSchema } from '$lib/schema/addresses/addressSchema.js';

	let { data } = $props();

	//console.log(data);

	const updateAddress = superForm(data.IupdateAddressSchema, {
		validators: zodClient(updateAddressSchema),
		id: 'updateAddress'
	});

	const {
		form: updateAddressData,
		enhance: updateAddressEnhance,
		message: updateAddressMessage
	} = updateAddress;

	let addressSuggestions: any[] = $state([]);
	let timeoutId: ReturnType<typeof setTimeout>;

	$effect(() => {
		$updateAddressData.id = data.IupdateAddressSchema?.data.id;
	});

	async function fetchAddressSuggestions(query: string) {
		if (query.length < 3) {
			addressSuggestions = [];
			return;
		}

		try {
			const response = await fetch(`/api/open-cage-data?q=${encodeURIComponent(query)}`);
			const { suggestions } = await response.json();

			if (Array.isArray(suggestions) && suggestions.length > 0) {
				addressSuggestions = suggestions;
			} else {
				addressSuggestions = []; // Aucun résultat
			}
		} catch (error) {
			console.error('Error fetching address suggestions:', error);
			addressSuggestions = [];
		}
	}

	function selectSuggestion(suggestion: any) {
		//console.log('Suggestion sélectionnée :', suggestion);

		// Force la conversion du Proxy en objet standard
		const components = JSON.parse(JSON.stringify(suggestion.components));

		//console.log('Données extraites après transformation :', components); // Vérification

		// Extraction sécurisée des données avec les bons noms de clés
		$updateAddressData.street_number = components.house_number || '';
		$updateAddressData.street = components.road || '';
		$updateAddressData.city = components.city || components.town || components.village || '';
		$updateAddressData.county = components.county || '';
		$updateAddressData.state = components.state || '';
		$updateAddressData.state_code = components.state_code || '';
		$updateAddressData.zip = components.postcode || '';
		$updateAddressData.country = components.country || '';
		$updateAddressData.country_code = components.country_code || '';

		// 🛠 Corrige l'accès aux clés avec des tirets !
		$updateAddressData.stateLetter = components['ISO_3166-1_alpha-2'] || '';
		$updateAddressData.ISO_3166_1_alpha_3 = components['ISO_3166-1_alpha-3'] || '';

		// Réinitialisation des suggestions après la sélection
		addressSuggestions = [];
	}

	$effect(() => {
		//console.log($updateAddressMessage);

		if ($updateAddressMessage === 'Address updated successfully') {
			toast.success($updateAddressMessage);
			setTimeout(() => goto('/auth/settings/address'), 0);
		}
	});

	function handleInput(event: Event) {
		const input = event.target as HTMLInputElement;
		clearTimeout(timeoutId);

		timeoutId = setTimeout(() => {
			fetchAddressSuggestions(input.value);
		}, 1000);
	}
</script>

<div class="w-[100vw] h-[100%] mx-auto px-4 py-6 space-y-6 ccc my-10">
	<h1 class="text-4xl font-s text-[#fe3d00]">Update the address</h1>

	{#if addressSuggestions.length > 0}
		<h2 class="text-xl font-semibold mb-4">Suggestions d'adresse</h2>
		<div class="space-y-4">
			<ScrollArea class="h-[200px]">
				{#each addressSuggestions as suggestion}
					<Card class="border border-gray-300 shadow-md hover:shadow-lg transition-shadow p-1">
						<div class="rcb">
							{suggestion.formatted}
							<Button
								class="cursor-pointer"
								onclick={() => selectSuggestion(suggestion)}
								onkeydown={(event) => event.code === 'Enter' && selectSuggestion(suggestion)}
							>
								Selectionner
							</Button>
						</div>
					</Card>
				{/each}
			</ScrollArea>
		</div>
	{/if}

	<form method="POST" action="?/updateAddress" use:updateAddressEnhance>
		<!-- Prénom -->
		<Form.Field name="first_name" form={updateAddress}>
			<Form.Control>
				<Form.Label>Prénom</Form.Label>
				<Input name="first_name" type="text" bind:value={$updateAddressData.first_name} />
			</Form.Control>
			<Form.FieldErrors />
		</Form.Field>

		<!-- Nom -->
		<Form.Field name="last_name" form={updateAddress}>
			<Form.Control>
				<Form.Label>Nom</Form.Label>
				<Input name="last_name" type="text" bind:value={$updateAddressData.last_name} />
			</Form.Control>
			<Form.FieldErrors />
		</Form.Field>

		<!-- Téléphone -->
		<Form.Field name="phone" form={updateAddress}>
			<Form.Control>
				<Form.Label>Téléphone</Form.Label>
				<Input name="phone" type="tel" bind:value={$updateAddressData.phone} />
			</Form.Control>
			<Form.FieldErrors />
		</Form.Field>

		<!-- Entreprise -->
		<Form.Field name="company" form={updateAddress}>
			<Form.Control>
				<Form.Label>Entreprise</Form.Label>
				<Input name="company" type="text" bind:value={$updateAddressData.company} />
			</Form.Control>
			<Form.FieldErrors />
		</Form.Field>

		<!-- Numéro de rue -->
		<Form.Field name="street_number" form={updateAddress}>
			<Form.Control>
				<Form.Label>Numéro</Form.Label>
				<Input name="street_number" type="text" bind:value={$updateAddressData.street_number} />
			</Form.Control>
			<Form.FieldErrors />
		</Form.Field>

		<!-- Rue -->
		<Form.Field name="street" form={updateAddress}>
			<Form.Control>
				<Form.Label>Rue</Form.Label>
				<Input
					name="street"
					type="text"
					oninput={handleInput}
					bind:value={$updateAddressData.street}
				/>
			</Form.Control>
			<Form.FieldErrors />
		</Form.Field>

		<!-- Ville -->
		<Form.Field name="city" form={updateAddress}>
			<Form.Control>
				<Form.Label>Ville</Form.Label>
				<Input name="city" type="text" bind:value={$updateAddressData.city} />
			</Form.Control>
			<Form.FieldErrors />
		</Form.Field>

		<!-- Code postal -->
		<Form.Field name="zip" form={updateAddress}>
			<Form.Control>
				<Form.Label>Code Postal</Form.Label>
				<Input name="zip" type="text" bind:value={$updateAddressData.zip} />
			</Form.Control>
			<Form.FieldErrors />
		</Form.Field>

		<!-- Pays -->
		<Form.Field name="country" form={updateAddress}>
			<Form.Control>
				<Form.Label>Pays</Form.Label>
				<Input name="country" type="text" bind:value={$updateAddressData.country} />
			</Form.Control>
			<Form.FieldErrors />
		</Form.Field>

		<Form.Field name="type" form={updateAddress}>
			<Form.Control>
				<Form.Label>Type d'adresse</Form.Label>
				<Select.Root bind:value={$updateAddressData.type} type="single">
					<Select.Trigger class="w-full">
						<span>{$updateAddressData.type || 'Sélectionner un type'}</span>
						<!-- 👈 Affiche la valeur sélectionnée -->
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="SHIPPING">Livraison</Select.Item>
						<Select.Item value="BILLING">Facturation</Select.Item>
					</Select.Content>
				</Select.Root>
			</Form.Control>
			<Form.FieldErrors />
		</Form.Field>

		<input type="hidden" name="id" bind:value={$updateAddressData.id} />
		{#each Object.keys($updateAddressData) as key}
			<input
				type="hidden"
				name={key}
				value={$updateAddressData[key as keyof typeof $updateAddressData] ?? ''}
			/>
		{/each}
		<div class="mt-6">
			<Button type="submit">update address</Button>
		</div>
	</form>
</div>
