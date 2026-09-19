<script lang="ts">
	import * as Card from '$shadcn/card';
	import { Input } from '$shadcn/input';
	import { Button } from '$shadcn/button';
	import { toast } from 'svelte-sonner';
	import { Copy, Gift, Users } from 'lucide-svelte';

	let { data } = $props();

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(data.referralLink);
			toast.success('Lien copié !');
		} catch {
			toast.error('Impossible de copier le lien');
		}
	}
</script>

<svelte:head>
	<title>Mon parrainage</title>
</svelte:head>

<div class="mx-auto max-w-[720px] px-6 pt-10 pb-12">
	<p class="mb-6">
		<a href="/auth/settings" class="text-foreground">← Mon compte</a>
	</p>
	<h1 class="mb-2 text-2xl font-semibold">Mon parrainage</h1>
	<p class="mb-6 text-muted-foreground">
		Partagez votre lien : vos filleuls reçoivent une remise sur leur première commande, et vous
		recevez une carte cadeau dès qu'ils passent commande.
	</p>

	<Card.Root class="mb-6">
		<Card.Header>
			<Card.Title>Mon lien unique</Card.Title>
			<Card.Description
				>À partager par email, réseaux sociaux, ou tout autre canal.</Card.Description
			>
		</Card.Header>
		<Card.Content>
			<div class="flex gap-2">
				<Input readonly value={data.referralLink} class="flex-1" />
				<Button onclick={copyLink} variant="secondary">
					<Copy class="h-4 w-4" />
					Copier
				</Button>
			</div>
		</Card.Content>
	</Card.Root>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<Users class="h-5 w-5 text-primary" />
					<span>Filleuls inscrits</span>
				</Card.Title>
			</Card.Header>
			<Card.Content>
				<p class="text-3xl font-semibold">{data.referredCount}</p>
			</Card.Content>
		</Card.Root>
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<Gift class="h-5 w-5 text-primary" />
					<span>Récompenses gagnées</span>
				</Card.Title>
			</Card.Header>
			<Card.Content>
				<p class="text-3xl font-semibold">{data.rewardsCount}</p>
			</Card.Content>
		</Card.Root>
	</div>
</div>
