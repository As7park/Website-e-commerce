<script lang="ts">
	import ShopPage from '$lib/components/shop/ShopPage.svelte';
	import { untrack } from 'svelte';
	import * as Form from '$shadcn/form';
	import { Input } from '$shadcn/input';
	import { Button } from '$shadcn/button';
	import { toast } from 'svelte-sonner';
	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';

	import { totpCodeSchema } from '$lib/schema/auth/totpCodeSchema';
	import { recoveryCodeSchema } from '$lib/schema/auth/recoveryCodeSchema';

	let { data } = $props();

	// Initialiser les formulaires Superform
	const totpForm = superForm(
		untrack(() => data?.totpForm ?? {}),
		{
			validators: zodClient(totpCodeSchema),
			id: 'totpForm'
		}
	);

	const recoveryCodeForm = superForm(
		untrack(() => data?.recoveryCodeForm ?? {}),
		{
			validators: zodClient(recoveryCodeSchema),
			id: 'recoveryCodeForm'
		}
	);

	const { form: totpData, enhance: totpEnhance, message: totpMessage } = totpForm;
	const {
		form: recoveryCodeData,
		enhance: recoveryCodeEnhance,
		message: recoveryCodeMessage
	} = recoveryCodeForm;

	// Notifications pour les messages d'erreur
	$effect(() => {
		if ($totpMessage) {
			toast.error($totpMessage);
		}
		if ($recoveryCodeMessage) {
			toast.error($recoveryCodeMessage);
		}
	});
</script>

<ShopPage
	title="Double authentification"
	crumbs={[{ label: 'Connexion', href: '/auth/login' }, { label: 'Double authentification' }]}
	width="narrow"
>
	<div class="shop-panel">
		<!-- Formulaire TOTP -->
		<section class="mb-8">
			<p class="shop-muted mb-6">Entrez le code de votre application d'authentification.</p>

			<form method="POST" action="?/totp" use:totpEnhance class="space-y-6">
				<Form.Field name="code" form={totpForm}>
					<Form.Control>
						<Form.Label>Code</Form.Label>
						<Input
							type="text"
							name="code"
							bind:value={$totpData.code}
							placeholder="Entrez votre code TOTP"
							autocomplete="one-time-code"
							required
						/>
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>

				<div class="mt-6">
					<Button type="submit" class="w-full">Vérifier</Button>
				</div>
			</form>
		</section>

		<!-- Formulaire de récupération -->
		<p class="shop-divider">ou</p>
		<section>
			<h2 class="shop-panel-title">Utiliser votre code de récupération</h2>

			<form method="POST" action="?/recovery_code" use:recoveryCodeEnhance class="space-y-6">
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

				<div class="mt-6">
					<Button type="submit" class="w-full">Vérifier</Button>
				</div>
			</form>
		</section>
	</div>
</ShopPage>
