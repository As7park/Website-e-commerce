<script lang="ts">
	import { Button } from '$shadcn/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$shadcn/card';
	import { formatDate } from '$lib/utils/formatDate';
	import { ArrowLeft, Mail, User, Calendar, MessageSquare } from 'lucide-svelte';
	import { goto } from '$app/navigation';

	// Props
	let { data } = $props();

	const contactSubmission = $derived(data.contactSubmission);
</script>

<div class="container mx-auto p-6 max-w-4xl">
	<!-- Header -->
	<div class="flex items-center gap-4 mb-6">
		<Button variant="outline" size="sm" onclick={() => goto('/admin/contacts')}>
			<ArrowLeft class="h-4 w-4 mr-2" />
			Retour
		</Button>
		<h1 class="text-2xl font-bold">Détails du message</h1>
	</div>

	<!-- Contact Information Card -->
	<Card class="mb-6">
		<CardHeader>
			<CardTitle class="flex items-center gap-2">
				<User class="h-5 w-5" />
				Informations de contact
			</CardTitle>
		</CardHeader>
		<CardContent class="space-y-4">
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<span class="text-sm font-medium text-muted-foreground">Nom</span>
					<p class="text-lg">{contactSubmission.name}</p>
				</div>
				<div>
					<span class="text-sm font-medium text-muted-foreground">Email</span>
					<p class="text-lg">{contactSubmission.email}</p>
				</div>
			</div>
			<div>
				<span class="text-sm font-medium text-muted-foreground">Date de création</span>
				<p class="text-lg flex items-center gap-2">
					<Calendar class="h-4 w-4" />
					{formatDate(contactSubmission.createdAt.toISOString())}
				</p>
			</div>
		</CardContent>
	</Card>

	<!-- Message Card -->
	<Card class="mb-6">
		<CardHeader>
			<CardTitle class="flex items-center gap-2">
				<MessageSquare class="h-5 w-5" />
				Message
			</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="mb-4">
				<span class="text-sm font-medium text-muted-foreground">Sujet</span>
				<p class="text-lg font-semibold">{contactSubmission.subject}</p>
			</div>
			<div>
				<span class="text-sm font-medium text-muted-foreground">Contenu</span>
				<div class="mt-2 p-4 bg-muted rounded-lg">
					<p class="whitespace-pre-wrap">{contactSubmission.message}</p>
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Actions -->
	<div class="flex gap-4">
		<Button
			onclick={() =>
				window.open(
					`mailto:${contactSubmission.email}?subject=Re: ${contactSubmission.subject}`,
					'_blank'
				)}
			class="flex items-center gap-2"
		>
			<Mail class="h-4 w-4" />
			Répondre par email
		</Button>
		<Button variant="outline" onclick={() => goto('/admin/contacts')}>Retour à la liste</Button>
	</div>
</div>
