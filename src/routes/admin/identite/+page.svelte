<script lang="ts">
	import { untrack } from 'svelte';
	import { Button } from '$shadcn/button';
	import { Input } from '$shadcn/input';
	import * as Form from '$shadcn/form';
	import { toast } from 'svelte-sonner';
	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { companyIdentitySchema } from '$lib/schema/settings/companyIdentitySchema';

	let { data } = $props();

	const companyForm = superForm(
		untrack(() => data.companyForm),
		{
			validators: zodClient(companyIdentitySchema),
			id: 'companyIdentity'
		}
	);
	const { form: companyFormData, enhance: companyEnhance, message: companyMessage } = companyForm;

	$effect(() => {
		if ($companyMessage) toast.success($companyMessage);
	});
</script>

<svelte:head>
	<title>Identité de l'entreprise — Admin</title>
</svelte:head>

<div class="px-6 space-y-6 max-w-2xl">
	<div>
		<h1 class="text-2xl font-semibold">Identité de l'entreprise</h1>
		<p class="text-sm text-muted-foreground">
			Alimente les mentions légales (<code>/mentions-legales</code>) et les factures/avoirs PDF. Un
			champ laissé vide reste « [À COMPLÉTER] » sur le site — voir
			<code>CONFORMITE_ECOMMERCE.md</code>.
		</p>
	</div>

	<form method="POST" use:companyEnhance class="space-y-3">
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
			<Form.Field name="name" form={companyForm}>
				<Form.Control>
					<Form.Label>Raison sociale</Form.Label>
					<Input name="name" bind:value={$companyFormData.name} />
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>
			<Form.Field name="legalForm" form={companyForm}>
				<Form.Control>
					<Form.Label>Forme juridique</Form.Label>
					<Input
						name="legalForm"
						placeholder="SASU, SARL..."
						bind:value={$companyFormData.legalForm}
					/>
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>
			<Form.Field name="shareCapital" form={companyForm}>
				<Form.Control>
					<Form.Label>Capital social</Form.Label>
					<Input
						name="shareCapital"
						placeholder="10 000 €"
						bind:value={$companyFormData.shareCapital}
					/>
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>
			<Form.Field name="publicationDirector" form={companyForm}>
				<Form.Control>
					<Form.Label>Directeur de la publication</Form.Label>
					<Input name="publicationDirector" bind:value={$companyFormData.publicationDirector} />
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>
			<Form.Field name="address" form={companyForm}>
				<Form.Control>
					<Form.Label>Adresse du siège</Form.Label>
					<Input
						name="address"
						placeholder="123 Rue des Affaires"
						bind:value={$companyFormData.address}
					/>
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>
			<Form.Field name="city" form={companyForm}>
				<Form.Control>
					<Form.Label>Code postal et ville</Form.Label>
					<Input name="city" placeholder="75000 Paris, France" bind:value={$companyFormData.city} />
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>
			<Form.Field name="siret" form={companyForm}>
				<Form.Control>
					<Form.Label>SIRET</Form.Label>
					<Input name="siret" bind:value={$companyFormData.siret} />
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>
			<Form.Field name="vatNumber" form={companyForm}>
				<Form.Control>
					<Form.Label>N° de TVA intracommunautaire</Form.Label>
					<Input name="vatNumber" bind:value={$companyFormData.vatNumber} />
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>
			<Form.Field name="phone" form={companyForm}>
				<Form.Control>
					<Form.Label>Téléphone</Form.Label>
					<Input name="phone" bind:value={$companyFormData.phone} />
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>
			<Form.Field name="email" form={companyForm}>
				<Form.Control>
					<Form.Label>E-mail de contact</Form.Label>
					<Input name="email" type="email" bind:value={$companyFormData.email} />
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>
		</div>
		<Button type="submit">Enregistrer</Button>
	</form>
</div>
