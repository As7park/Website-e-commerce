<script lang="ts">
	import ShopPage from '$lib/components/shop/ShopPage.svelte';
	import { untrack } from 'svelte';
	import * as Form from '$shadcn/form';
	import { Input } from '$shadcn/input';
	import { Button } from '$shadcn/button';
	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { totpCodeSchema } from '$lib/schema/auth/totpCodeSchema';
	import { toast } from 'svelte-sonner';

	let { data } = $props();

	// Initialiser le formulaire Superform avec Zod
	const totpForm = superForm(
		untrack(() => data?.totpForm ?? {}),
		{
			validators: zodClient(totpCodeSchema),
			id: 'totpForm'
		}
	);

	const { form: totpData, enhance: totpEnhance, message: totpMessage } = totpForm;

	$effect(() => {
		if ($totpMessage) {
			toast.error($totpMessage);
		}

		//console.log($totpData);
	});
</script>

<ShopPage
	title="Double authentification"
	lead="Saisissez le code affiché par votre application d’authentification."
	crumbs={[{ label: 'Double authentification' }]}
	width="narrow"
>
	<div class="shop-panel">
		<!-- Formulaire TOTP -->
		<form method="POST" action="?/totp" use:totpEnhance class="space-y-6">
			<div>
				<Form.Field name="code" form={totpForm}>
					<Form.Control>
						<Form.Label>Code d’authentification</Form.Label>
						<Input
							type="text"
							name="code"
							bind:value={$totpData.code}
							placeholder="123456"
							autocomplete="one-time-code"
							required
						/>
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>
			</div>

			<div class="mt-6">
				<Button type="submit" class="w-full">Vérifier</Button>
			</div>
		</form>

		<!-- Lien pour utiliser le code de récupération -->
		<div class="shop-links-row">
			<a href="/auth/2fa/reset" class="shop-link">Utiliser un code de récupération</a>
		</div>
	</div>
</ShopPage>
