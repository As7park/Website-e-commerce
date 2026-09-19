<script lang="ts">
	import { cn } from '$lib/components/shadcn/utils.js';
	import Star from 'lucide-svelte/icons/star';

	let {
		value = $bindable(0),
		readonly = false,
		size = 'size-5'
	}: {
		value?: number;
		readonly?: boolean;
		size?: string;
	} = $props();

	const stars = [1, 2, 3, 4, 5];
</script>

{#if readonly}
	<div class="inline-flex items-center gap-0.5" aria-hidden="true">
		{#each stars as n (n)}
			<Star
				class={cn(
					size,
					n <= Math.round(value) ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground'
				)}
			/>
		{/each}
	</div>
{:else}
	<div class="inline-flex items-center gap-0.5" role="radiogroup" aria-label="Note sur 5">
		{#each stars as n (n)}
			<button
				type="button"
				role="radio"
				aria-checked={value === n}
				aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
				class="rounded p-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
				onclick={() => (value = n)}
			>
				<Star
					class={cn(size, n <= value ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground')}
				/>
			</button>
		{/each}
	</div>
{/if}
