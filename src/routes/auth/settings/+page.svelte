<script lang="ts">
	import { untrack } from 'svelte';
	import * as Form from '$shadcn/form';
	import { Input } from '$shadcn/input';
	import { Button } from '$shadcn/button';
	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { toast } from 'svelte-sonner';
	import { enhance } from '$app/forms';
	import { emailSchema, passwordSchema } from '$lib/schema/auth/settingsSchemas';
	import { Switch } from '$shadcn/switch/index.js';
	import { Label } from '$shadcn/label/index.js';
	import { isMfaEnabledSchema } from '$lib/schema/users/MfaEnabledSchema.js';

	let { data } = $props();

	let marketingOptIn = $state(untrack(() => data.marketingEmailsOptIn));

	// Initialiser les formulaires Superform
	const emailForm = superForm(
		untrack(() => data.emailForm),
		{
			validators: zodClient(emailSchema),
			id: 'emailForm'
		}
	);

	const passwordForm = superForm(
		untrack(() => data.passwordForm),
		{
			validators: zodClient(passwordSchema),
			id: 'passwordForm'
		}
	);

	const isMfaEnabledForm = superForm(
		untrack(() => data.isMfaEnabledForm),
		{
			validators: zodClient(isMfaEnabledSchema),
			id: 'isMfaEnabledForm'
		}
	);

	const { form: emailData, enhance: emailEnhance, message: emailMessage } = emailForm;
	const { form: passwordData, enhance: passwordEnhance, message: passwordMessage } = passwordForm;
	// Carte MFA actuellement masquée dans le template : pas de use:enhance à câbler tant qu'elle est commentée.
	const { form: isMfaEnabledData, message: isMfaEnabledMessage } = isMfaEnabledForm;

	// Notifications pour les messages d'erreur
	const SUCCESS_MESSAGES = ['Password modified successfully'];

	$effect(() => {
		if ($emailMessage) {
			toast.error($emailMessage);
		}
		if ($passwordMessage) {
			if (SUCCESS_MESSAGES.includes($passwordMessage)) {
				toast.success($passwordMessage);
			} else {
				toast.error($passwordMessage);
			}
		}
		if ($isMfaEnabledMessage && $isMfaEnabledMessage.text === 'Authentication modifiée') {
			$isMfaEnabledData.isMfaEnabled = $isMfaEnabledMessage.newStatus;
			toast.success($isMfaEnabledMessage.text);
		}
	});
</script>

<header class="shop-page-head">
	<h1 class="shop-page-title">Mon compte</h1>
	<p class="shop-page-lead">
		Bonjour {data.user.name || data.user.email}, gérez ici vos informations.
	</p>
</header>

<div class="shop-account-grid">
	<div class="shop-panel">
		<h2 class="shop-panel-title">Informations personnelles</h2>
		<div class="space-y-2 text-sm">
			{#if data.user.name}
				<p><span class="shop-muted">Nom :</span> {data.user.name}</p>
			{/if}
			<p><span class="shop-muted">E-mail :</span> {data.user.email}</p>
		</div>
	</div>

	{#if data.user.role === 'CLIENT'}
		<div class="shop-panel">
			<h2 class="shop-panel-title">Communications</h2>
			<p class="shop-muted mb-4 text-sm">
				Les e-mails liés à vos commandes (facture, confirmation) sont toujours envoyés, quel que
				soit ce réglage.
			</p>
			<form
				method="POST"
				action="?/marketingEmailsOptIn"
				use:enhance={() => {
					return async ({ result }) => {
						if (result.type === 'success' && result.data) {
							marketingOptIn = result.data.marketingEmailsOptIn as boolean;
							toast.success(
								marketingOptIn ? 'Emails marketing activés' : 'Emails marketing désactivés'
							);
						}
					};
				}}
			>
				<div class="flex items-center justify-between border border-border p-3">
					<Label for="marketing-switch" class="flex-grow cursor-pointer pr-4">
						Offres, nouveautés et alertes (retour en stock, relance panier)
					</Label>
					<Switch id="marketing-switch" checked={marketingOptIn} type="submit" />
				</div>
			</form>
		</div>
	{/if}

	{#if !data.user.googleId}
		<form method="POST" action="?/email" use:emailEnhance class="shop-panel">
			<h2 class="shop-panel-title">Changer d'e-mail</h2>
			<Form.Field name="email" form={emailForm}>
				<Form.Control>
					<Form.Label>Nouvel e-mail</Form.Label>
					<Input
						type="email"
						name="email"
						bind:value={$emailData.email}
						placeholder="nouveau@email.com"
						required
					/>
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>
			<Button type="submit" class="mt-4 w-full">Mettre à jour l'e-mail</Button>
		</form>

		<form method="POST" action="?/password" use:passwordEnhance class="shop-panel">
			<h2 class="shop-panel-title">Changer de mot de passe</h2>
			<div class="space-y-4">
				<Form.Field name="password" form={passwordForm}>
					<Form.Control>
						<Form.Label>Mot de passe actuel</Form.Label>
						<Input
							type="password"
							name="password"
							bind:value={$passwordData.password}
							autocomplete="current-password"
							required
						/>
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>
				<Form.Field name="new_password" form={passwordForm}>
					<Form.Control>
						<Form.Label>Nouveau mot de passe</Form.Label>
						<Input
							type="password"
							name="new_password"
							bind:value={$passwordData.new_password}
							autocomplete="new-password"
							required
						/>
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>
			</div>
			<Button type="submit" class="mt-4 w-full">Changer le mot de passe</Button>
		</form>

		<!-- Authentification à deux facteurs -->
		<!-- <Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<ShieldCheck class="w-6 h-6 text-primary" />
						<span>Authentification à deux facteurs</span>
					</Card.Title>
					<Card.Description>Renforcez la sécurité de votre compte.</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="flex items-center justify-between rounded-lg border p-3">
						<Label for="mfa-switch" class="flex-grow cursor-pointer pr-4">Activer/Désactiver</Label>
						<form method="POST" action="?/isMfaEnabled" use:isMfaEnabledEnhance>
							<Form.Field name="isMfaEnabled" form={isMfaEnabledForm}>
								<Form.Control>
									<Switch
										name="isMfaEnabled"
										id="mfa-switch"
										bind:checked={$isMfaEnabledData.isMfaEnabled}
										type="submit"
									/>
								</Form.Control>
							</Form.Field>
						</form>
					</div>
				</Card.Content>
				{#if data.user.registered2FA && data.user.isMfaEnabled}
					<Card.Footer>
						<a href="/auth/2fa/setup" class="text-sm text-primary hover:underline">
							Reconfigurer le 2FA et voir les codes de secours
						</a>
					</Card.Footer>
				{/if}
			</Card.Root> -->
	{/if}
</div>
