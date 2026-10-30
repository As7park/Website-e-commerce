<script lang="ts">
	import ShopPage from '#lib/components/shop/ShopPage.svelte';
	import { untrack } from 'svelte';
	import * as Form from '#shadcn/form';
	import { Input } from '#shadcn/input';
	import { Button } from '#shadcn/button';
	import { toast } from 'svelte-sonner';
	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { RETRY_FRIENDLY_FORM } from '#lib/forms/superformOptions';
	import { verifyCodeSchema } from '#lib/schema/auth/verifyCodeSchema';

	let { data } = $props();
	//console.log(data);

	// Initialiser le formulaire Superform avec Zod
	const verifyEmailForm = superForm(
		untrack(() => data?.verifyEmailForm ?? {}),
		{
			validators: zodClient(verifyCodeSchema),
			id: 'verifyEmailForm',
			...RETRY_FRIENDLY_FORM
		}
	);

	const {
		form: verifyEmailData,
		enhance: verifyEmailEnhance,
		message: verifyEmailMessage
	} = verifyEmailForm;

	// Notifications pour les messages d'erreur
	$effect(() => {
		if ($verifyEmailMessage) {
			toast.error($verifyEmailMessage);
		}
	});
</script>

<ShopPage
	title="Vérifiez votre e-mail"
	lead={`Un code à 8 chiffres a été envoyé à ${data.email}.`}
	crumbs={[{ label: 'Connexion', href: '/auth/login' }, { label: 'Vérification de l’e-mail' }]}
	width="narrow"
>
	<div class="shop-panel">
		<form method="POST" action="?/verify" use:verifyEmailEnhance class="space-y-6">
			<div>
				<Form.Field name="code" form={verifyEmailForm}>
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label>Code</Form.Label>
							<Input
								{...props}
								type="text"
								name="code"
								bind:value={$verifyEmailData.code}
								placeholder="Entrez votre code de vérification"
								required
							/>
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>
			</div>

			<div class="mt-6">
				<Button type="submit" class="w-full">Vérifier</Button>
			</div>

			<p class="text-center mt-4 text-sm text-destructive">{$verifyEmailMessage ?? ''}</p>
		</form>
	</div>
</ShopPage>
