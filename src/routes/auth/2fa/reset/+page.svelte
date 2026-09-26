<script lang="ts">
	import ShopPage from '$lib/components/shop/ShopPage.svelte';
	import { untrack } from 'svelte';
	import * as Form from '$shadcn/form';
	import { Input } from '$shadcn/input';
	import { Button } from '$shadcn/button';
	import { toast } from 'svelte-sonner';
	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { recoveryCodeSchema } from '$lib/schema/auth/recoveryCodeSchema';

	let { data } = $props();

	// Initialiser le formulaire Superform avec Zod
	const recoveryCodeForm = superForm(
		untrack(() => data?.verifyCodeForm ?? {}),
		{
			validators: zodClient(recoveryCodeSchema),
			id: 'recoveryCodeForm'
		}
	);

	const {
		form: recoveryCodeData,
		enhance: recoveryCodeEnhance,
		message: recoveryCodeMessage
	} = recoveryCodeForm;

	// Notifications pour les messages d'erreur
	$effect(() => {
		if ($recoveryCodeMessage) {
			toast.error($recoveryCodeMessage);
		}
	});
</script>

<ShopPage
	title="Récupérer votre compte"
	lead="Entrez votre code de récupération pour accéder à votre compte."
	crumbs={[
		{ label: 'Double authentification', href: '/auth/2fa' },
		{ label: 'Code de récupération' }
	]}
	width="narrow"
>
	<div class="shop-panel">
		<form method="POST" action="?/recovery_code" use:recoveryCodeEnhance class="space-y-6">
			<div>
				<Form.Field name="code" form={recoveryCodeForm}>
					<Form.Control>
						<Form.Label>Code de récupération</Form.Label>
						<Input
							type="text"
							name="code"
							bind:value={$recoveryCodeData.code}
							placeholder="Entrez votre code de récupération"
							required
						/>
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>
			</div>

			<div class="mt-6">
				<Button type="submit" class="w-full">Vérifier</Button>
			</div>

			<p class="text-center mt-4 text-sm text-destructive">{$recoveryCodeMessage ?? ''}</p>
		</form>
	</div>
</ShopPage>
