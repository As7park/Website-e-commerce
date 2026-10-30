<script lang="ts">
	import ShopPage from '#lib/components/shop/ShopPage.svelte';
	import { untrack } from 'svelte';
	import * as Form from '#shadcn/form';
	import { Input } from '#shadcn/input';
	import { Button } from '#shadcn/button';
	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { RETRY_FRIENDLY_FORM } from '#lib/forms/superformOptions';
	import { loginSchema } from '#lib/schema/auth/loginSchema';
	import { toast } from 'svelte-sonner';
	import { authClient } from '#lib/auth/client';

	let { data } = $props();

	async function signInWithGoogle() {
		await authClient.signIn.social({ provider: 'google', callbackURL: '/auth' });
	}

	//console.log(data);

	// Initialiser le formulaire Superform avec Zod
	const loginForm = superForm(
		untrack(() => data?.loginForm ?? {}),
		{
			validators: zodClient(loginSchema),
			id: 'loginForm',
			...RETRY_FRIENDLY_FORM
		}
	);

	const { form: loginData, enhance: loginEnhance, message: loginMessage } = loginForm;

	$effect(() => {
		if ($loginMessage) {
			toast.error($loginMessage);
		}
	});
</script>

<ShopPage title="Connexion" crumbs={[{ label: 'Connexion' }]} width="narrow">
	<div class="shop-panel">
		<form method="POST" action="?/login" use:loginEnhance class="space-y-6">
			<div>
				<Form.Field name="email" form={loginForm}>
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label>Email</Form.Label>
							<Input
								{...props}
								type="email"
								name="email"
								bind:value={$loginData.email}
								placeholder="Entrez votre email"
								required
							/>
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>
			</div>

			<div>
				<Form.Field name="password" form={loginForm}>
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label>Mot de passe</Form.Label>
							<Input
								{...props}
								type="password"
								name="password"
								bind:value={$loginData.password}
								placeholder="Entrez votre mot de passe"
								required
							/>
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>
			</div>
			<div class="mt-6">
				<Button type="submit" class="w-full">Continuer</Button>
			</div>
		</form>

		<p class="shop-divider">ou</p>
		<Button type="button" variant="outline" class="w-full" onclick={signInWithGoogle}>
			Continuer avec Google
		</Button>

		<div class="shop-links-row">
			<a href="/auth/signup" class="shop-link">Créer un compte</a>
			<a href="/auth/forgot-password" class="shop-link">Mot de passe oublié ?</a>
		</div>
	</div>
</ShopPage>
