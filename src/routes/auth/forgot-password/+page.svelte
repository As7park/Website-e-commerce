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
	import { forgotPasswordSchema } from '#lib/schema/auth/forgotPasswordSchema';

	let { data } = $props();

	// Initialiser le formulaire Superform avec Zod
	const forgotForm = superForm(
		untrack(() => data.forgotForm),
		{
			validators: zodClient(forgotPasswordSchema),
			id: 'forgotForm',
			...RETRY_FRIENDLY_FORM
		}
	);

	const { form: forgotData, enhance: forgotEnhance, message: forgotMessage } = forgotForm;

	// Notification d'erreur si un message est reçu
	$effect(() => {
		if ($forgotMessage) {
			toast.error($forgotMessage);
		}
	});
</script>

<ShopPage
	title="Mot de passe oublié"
	crumbs={[{ label: 'Connexion', href: '/auth/login' }, { label: 'Mot de passe oublié' }]}
	width="narrow"
>
	<div class="shop-panel">
		<form method="POST" action="?/forgotPassword" use:forgotEnhance class="space-y-6">
			<div>
				<Form.Field name="email" form={forgotForm}>
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label>Email</Form.Label>
							<Input
								{...props}
								type="email"
								name="email"
								bind:value={$forgotData.email}
								placeholder="Entrez votre adresse email"
								required
							/>
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>
			</div>

			<div class="mt-6">
				<Button type="submit" class="w-full">Envoyer</Button>
			</div>

			<p class="text-center mt-4 text-sm text-destructive">{$forgotMessage ?? ''}</p>
		</form>

		<div class="shop-links-row">
			<a href="/auth/login" class="shop-link">← Retour à la connexion</a>
		</div>
	</div>
</ShopPage>
