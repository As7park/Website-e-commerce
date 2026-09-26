<script lang="ts">
	import ShopPage from '$lib/components/shop/ShopPage.svelte';
	import { untrack } from 'svelte';
	import * as Form from '$shadcn/form';
	import { Input } from '$shadcn/input';
	import { Button } from '$shadcn/button';
	import { superForm } from 'sveltekit-superforms/client';
	import { signupSchema } from '$lib/schema/auth/signupSchema';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { zodClient } from 'sveltekit-superforms/adapters';

	let { data } = $props();

	const signupForm = superForm(
		untrack(() => data.form),
		{
			validators: zodClient(signupSchema),
			id: 'signupForm'
		}
	);

	const { form: signupData, enhance: signupEnhance, message: signupMessage } = signupForm;

	$effect(() => {
		if ($signupMessage === 'vous etes deja inscrit avec cette adresse email.') {
			toast.error($signupMessage);
			setTimeout(() => goto('/auth/login'), 0);
		}
	});
</script>

<ShopPage title="Créer un compte" crumbs={[{ label: 'Créer un compte' }]} width="narrow">
	<div class="shop-panel">
		{#if data.referralCode}
			<p class="mb-4 text-sm text-muted-foreground">
				Vous avez été invité·e par un·e ami·e 🎉 votre première commande bénéficiera d'une remise.
			</p>
		{/if}

		<form method="POST" use:signupEnhance action="?/signup" class="space-y-4">
			<input type="hidden" name="ref" value={data.referralCode ?? ''} />
			<div class="mb-4">
				<Form.Field name="username" form={signupForm}>
					<Form.Control>
						<Form.Label>Nom d'utilisateur</Form.Label>
						<Input name="username" type="text" bind:value={$signupData.username} required />
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>
			</div>

			<div class="mb-4">
				<Form.Field name="email" form={signupForm}>
					<Form.Control>
						<Form.Label>Email</Form.Label>
						<Input name="email" type="email" bind:value={$signupData.email} required />
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>
			</div>

			<div class="mb-4">
				<Form.Field name="password" form={signupForm}>
					<Form.Control>
						<Form.Label>Mot de passe</Form.Label>
						<Input name="password" type="password" bind:value={$signupData.password} required />
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>
			</div>

			<div class="mt-6">
				<Button type="submit" class="w-full">S'inscrire</Button>
			</div>
		</form>

		<p class="shop-divider">ou</p>
		<Button href="/auth/login/google" variant="outline" class="w-full">Continuer avec Google</Button
		>

		<div class="shop-links-row">
			<span class="shop-muted">Déjà un compte ?</span>
			<a href="/auth/login" class="shop-link">Se connecter</a>
		</div>
	</div>
</ShopPage>
