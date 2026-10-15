<script lang="ts">
	import { untrack } from 'svelte';
	import * as Form from '$shadcn/form';
	import { Input } from '$shadcn/input';
	import { Textarea } from '$shadcn/textarea';
	import { Button } from '$shadcn/button';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { RETRY_FRIENDLY_FORM } from '$lib/forms/superformOptions';
	import { contactSchema } from '$lib/schema/contact/contactSchema';
	import SEO from '$lib/components/SEO.svelte';

	let { data } = $props();

	const contactForm = superForm(
		untrack(() => data.form),
		{
			validators: zodClient(contactSchema),
			id: 'contactForm',
			...RETRY_FRIENDLY_FORM
		}
	);

	const { form: contactData, enhance: contactEnhance, message: contactMessage } = contactForm;

	$effect(() => {
		if ($contactMessage === 'Message envoyé') {
			toast.success($contactMessage);
		} else if ($contactMessage) {
			toast.error($contactMessage);
		}
	});
</script>

<SEO pageKey="contact" />

<div class="relative box-border min-h-screen w-full px-8 pt-24 pb-8">
	<div class="mx-auto w-full max-w-[600px] rounded-lg border p-6 shadow-lg backdrop-blur-3xl">
		<h1 class="mb-6 text-2xl font-bold">Contact</h1>

		<form method="POST" action="?/send" use:contactEnhance class="space-y-4">
			<Form.Field name="name" form={contactForm}>
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Nom</Form.Label>
						<Input {...props} name="name" type="text" bind:value={$contactData.name} />
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Form.Field name="email" form={contactForm}>
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Email</Form.Label>
						<Input {...props} name="email" type="email" bind:value={$contactData.email} />
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Form.Field name="subject" form={contactForm}>
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Sujet</Form.Label>
						<Input {...props} name="subject" type="text" bind:value={$contactData.subject} />
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Form.Field name="message" form={contactForm}>
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Message</Form.Label>
						<Textarea {...props} name="message" bind:value={$contactData.message} rows={6} />
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Button type="submit">Envoyer</Button>
		</form>
	</div>
</div>
