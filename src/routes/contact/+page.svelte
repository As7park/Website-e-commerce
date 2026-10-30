<script lang="ts">
	import { untrack } from 'svelte';
	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { toast } from 'svelte-sonner';
	import { RETRY_FRIENDLY_FORM } from '#lib/forms/superformOptions';
	import { contactSchema } from '#lib/schema/contact/contactSchema';
	import { reveal } from '#lib/actions/reveal';
	import SEO from '#lib/components/SEO.svelte';
	import PageBanner from '#lib/components/shop/fx/PageBanner.svelte';
	import PageDivider from '#lib/components/shop/fx/PageDivider.svelte';
	import { sectionBg } from '#lib/shop/fx';

	let { data } = $props();

	const contactFormCtx = superForm(
		untrack(() => data.form),
		{
			validators: zodClient(contactSchema),
			id: 'contactForm',
			resetForm: true,
			...RETRY_FRIENDLY_FORM
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

<PageBanner
	word="Contact"
	num="03"
	crumbs={[{ label: 'Contact' }]}
	eyebrow="Service client"
	title="Contactez"
	accent="nous"
	lead="Une question sur une pièce, une taille ou une commande ? Écrivez-nous, on vous répond au plus vite."
	chips={[
		{ label: 'Suivi de commande', href: '/suivi-commande', hot: true },
		{ label: 'Mon compte', href: '/auth/settings' }
	]}
	tapes={[
		['Une question ?', 'On vous répond'],
		['Service client', 'AS7 Park']
	]}
/>

<main class="shop-container" use:sectionBg={'#0f1713'}>
	<div class="shop-contact-layout">
		<div use:reveal>
			<h2 class="shop-section-title">Écrivez-nous</h2>
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
					class="shop-btn shop-btn-block"
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
				<p>AS7 Park</p>
			</div>
			<div>
				<h4>E-mail</h4>
				<p><a href="mailto:contact@as7park.com">contact@as7park.com</a></p>
			</div>
			<div>
				<h4>Réseaux</h4>
				<p>
					<a href="https://www.instagram.com/as7park/" target="_blank" rel="noopener noreferrer"
						>Instagram</a
					>
				</p>
				<p>
					<a href="https://www.facebook.com/as7park/" target="_blank" rel="noopener noreferrer"
						>Facebook</a
					>
				</p>
			</div>
		</div>
	</div>
</main>

<PageDivider />
