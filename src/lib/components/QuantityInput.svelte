<script lang="ts">
	import { untrack } from 'svelte';

	interface Props {
		value: number;
		min?: number;
		max?: number;
		disabled?: boolean;
		onCommit: (value: number) => void;
		id?: string;
		class?: string;
	}

	let {
		value,
		min = 1,
		max,
		disabled = false,
		onCommit,
		id,
		class: className = ''
	}: Props = $props();

	// Copie éditable locale, resynchronisée si la valeur externe change
	// (ex : clamp appliqué par le store après un commit précédent).
	let draft = $state(untrack(() => value));
	$effect(() => {
		draft = value;
	});

	function commit() {
		let next = Math.trunc(draft);
		if (!Number.isFinite(next) || next < min) next = min;
		if (max !== undefined && next > max) next = max;
		draft = next;
		if (next !== value) onCommit(next);
	}
</script>

<input
	{id}
	type="number"
	{min}
	{max}
	step="1"
	bind:value={draft}
	onchange={commit}
	{disabled}
	class="w-20 rounded-md border px-2 py-1 text-sm {className}"
/>
