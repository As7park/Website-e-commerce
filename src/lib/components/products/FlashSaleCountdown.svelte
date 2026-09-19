<script lang="ts">
	import Flame from 'lucide-svelte/icons/flame';

	interface Props {
		endsAt: string | Date | null | undefined;
		/** `compact` = badge inline (carte catalogue), `full` = bandeau (fiche produit). */
		variant?: 'compact' | 'full';
	}

	let { endsAt, variant = 'full' }: Props = $props();

	const endDate = $derived(endsAt ? new Date(endsAt) : null);

	// Recalculé chaque seconde tant que le composant est monté et qu'une date
	// de fin est fournie — pas besoin de tourner sinon (produit sans vente flash).
	let now = $state(Date.now());
	$effect(() => {
		if (!endDate) return;
		const interval = setInterval(() => {
			now = Date.now();
		}, 1000);
		return () => clearInterval(interval);
	});

	const remainingMs = $derived(endDate ? endDate.getTime() - now : 0);
	const isActive = $derived(Boolean(endDate) && remainingMs > 0);

	const timeParts = $derived.by(() => {
		const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
		return {
			days: Math.floor(totalSeconds / 86400),
			hours: Math.floor((totalSeconds % 86400) / 3600),
			minutes: Math.floor((totalSeconds % 3600) / 60),
			seconds: totalSeconds % 60
		};
	});

	function pad(n: number) {
		return String(n).padStart(2, '0');
	}
</script>

{#if isActive}
	{#if variant === 'compact'}
		<span
			class="inline-flex items-center gap-1 rounded bg-destructive px-2 py-0.5 text-xs font-medium text-destructive-foreground"
		>
			<Flame class="h-3 w-3" />
			{#if timeParts.days > 0}
				{timeParts.days}j {pad(timeParts.hours)}h
			{:else}
				{pad(timeParts.hours)}:{pad(timeParts.minutes)}:{pad(timeParts.seconds)}
			{/if}
		</span>
	{:else}
		<div
			class="flex items-center gap-2 rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground"
		>
			<Flame class="h-4 w-4 shrink-0" />
			<span>Vente flash — se termine dans</span>
			<span class="font-mono tabular-nums">
				{#if timeParts.days > 0}
					{timeParts.days}j {pad(timeParts.hours)}h {pad(timeParts.minutes)}m
				{:else}
					{pad(timeParts.hours)}:{pad(timeParts.minutes)}:{pad(timeParts.seconds)}
				{/if}
			</span>
		</div>
	{/if}
{/if}
