<script lang="ts">
	import ShopPage from '$lib/components/shop/ShopPage.svelte';
	import { untrack } from 'svelte';
	import * as Form from '$shadcn/form';
	import Input from '$shadcn/input/input.svelte';
	import Button from '$shadcn/button/button.svelte';
	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { totpSchema } from '$lib/schema/auth/totpSchema';
	import { toast } from 'svelte-sonner';

	let { data } = $props();

	const twoFactorForm = superForm(
		untrack(() => data.totpForm),
		{
			validators: zodClient(totpSchema),
			id: 'twoFactorForm'
		}
	);

	const { form: twoFactorData, enhance: formEnhance, message: formMessage } = twoFactorForm;

	$effect(() => {
		if ($formMessage === 'TOTP setup completed successfully') {
			toast.success($formMessage);
		} else if ($formMessage) {
			toast.error($formMessage);
		}
	});
</script>

<ShopPage
	title="Activer la double authentification"
	crumbs={[{ label: 'Mon compte', href: '/auth/settings' }, { label: 'Double authentification' }]}
	width="narrow"
>
	<div class="shop-panel">
		<div class="flex flex-col items-center">
			<!-- QR Code -->
			<div class="w-64 h-64 mb-4 bg-white p-2">
				{@html data.qrcode}
			</div>

			<!-- Formulaire TOTP -->
			<form
				method="POST"
				use:formEnhance
				action="?/setuptotp"
				class="space-y-4 w-full max-w-sm mx-auto"
			>
				<input type="hidden" name="encodedTOTPKey" value={data.encodedTOTPKey} required />

				<!-- Champ de code TOTP -->
				<Form.Field name="code" form={twoFactorForm}>
					<Form.Control>
						<Form.Label>Code de vérification</Form.Label>
						<Input
							id="form-totp-code"
							name="code"
							type="text"
							placeholder="Entrez le code"
							bind:value={$twoFactorData.code}
							required
							class="mt-1 block w-full"
						/>
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>

				<!-- Bouton de soumission -->
				<div class="mt-6">
					<Button type="submit" class="w-full">Valider</Button>
				</div>
			</form>
		</div>
	</div>
</ShopPage>
