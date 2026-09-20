<script lang="ts">
	import { untrack } from 'svelte';
	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { toast } from 'svelte-sonner';
	import { contactSchema } from '$lib/schema/contact/contactSchema';
	import { reveal } from '$lib/actions/reveal';
	import SEO from '$lib/components/SEO.svelte';

	let { data } = $props();

	const contactFormCtx = superForm(
		untrack(() => data.form),
		{
			validators: zodClient(contactSchema),
			id: 'contactForm',
			resetForm: true
		}
	);
	const {
		form: contactData,
		errors: contactErrors,
		enhance: contactEnhance,
		message: contactMessage,
		delayed: contactDelayed
	} = contactFormCtx;

	let justSent = $state(false);

	$effect(() => {
		if (!$contactMessage) return;
		if ($contactMessage === 'Message envoyé') {
			toast.success($contactMessage);
			justSent = true;
			setTimeout(() => (justSent = false), 1400);
		} else {
			toast.error($contactMessage);
		}
	});
</script>

<SEO pageKey="contact" />

<nav class="shop-breadcrumb"><a href="/">Accueil</a> / Contact</nav>

<main class="shop-container">
	<div class="shop-contact-layout">
		<div use:reveal>
			<h1 class="shop-section-title">Nous contacter</h1>
			<form method="POST" action="?/send" use:contactEnhance>
				<div class="shop-form-field">
					<label for="contact-name">Nom</label>
					<input
						id="contact-name"
						name="name"
						type="text"
						bind:value={$contactData.name}
						required
					/>
					{#if $contactErrors.name}<p class="shop-form-error">{$contactErrors.name}</p>{/if}
				</div>
				<div class="shop-form-field">
					<label for="contact-email">E-mail</label>
					<input
						id="contact-email"
						name="email"
						type="email"
						bind:value={$contactData.email}
						required
					/>
					{#if $contactErrors.email}<p class="shop-form-error">{$contactErrors.email}</p>{/if}
				</div>
				<div class="shop-form-field">
					<label for="contact-subject">Sujet</label>
					<input
						id="contact-subject"
						name="subject"
						type="text"
						bind:value={$contactData.subject}
						required
					/>
					{#if $contactErrors.subject}<p class="shop-form-error">{$contactErrors.subject}</p>{/if}
				</div>
				<div class="shop-form-field">
					<label for="contact-message">Message</label>
					<textarea id="contact-message" name="message" bind:value={$contactData.message} required
					></textarea>
					{#if $contactErrors.message}<p class="shop-form-error">{$contactErrors.message}</p>{/if}
				</div>
				<button
					type="submit"
					class="shop-btn"
					class:shop-btn-success={justSent}
					disabled={$contactDelayed}
				>
					{#if justSent}
						Envoyé ✓
					{:else}
						{$contactDelayed ? 'Envoi…' : 'Envoyer le message'}
					{/if}
				</button>
			</form>
		</div>

		<div class="shop-contact-info" use:reveal={{ delay: 100 }}>
			<div>
				<h4>Adresse</h4>
				<p>MadeInDiamonds</p>
			</div>
			<div>
				<h4>E-mail</h4>
				<p>contact@madeindiamonds.com</p>
			</div>
			<div>
				<h4>Réseaux</h4>
				<p><a href="#">Instagram</a></p>
				<p><a href="#">Facebook</a></p>
			</div>
		</div>
	</div>
</main>
