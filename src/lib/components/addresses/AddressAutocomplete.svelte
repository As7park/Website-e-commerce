<script lang="ts">
	import { Input } from '$shadcn/input';
	import { Label } from '$shadcn/label';
	import type { AddressSuggestion } from '$lib/addresses/types';

	interface Props {
		id?: string;
		name?: string;
		label?: string;
		placeholder?: string;
		onSelect: (suggestion: AddressSuggestion) => void;
	}

	let {
		id = 'address-search',
		name = 'address_search',
		label = 'Rechercher une adresse',
		placeholder = 'Numéro, rue, ville…',
		onSelect
	}: Props = $props();

	let query = $state('');
	let suggestions = $state<AddressSuggestion[]>([]);
	let open = $state(false);
	let loading = $state(false);
	let noResults = $state(false);
	let activeIndex = $state(-1);
	let containerEl: HTMLDivElement;
	let debounceId: ReturnType<typeof setTimeout>;
	let controller: AbortController | null = null;

	async function search(value: string) {
		controller?.abort();

		if (value.trim().length < 3) {
			suggestions = [];
			noResults = false;
			open = false;
			return;
		}

		controller = new AbortController();
		loading = true;
		open = true;
		try {
			const response = await fetch(`/api/address-search?q=${encodeURIComponent(value)}`, {
				signal: controller.signal
			});
			const data = await response.json();
			suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
			noResults = suggestions.length === 0;
			activeIndex = -1;
		} catch (err) {
			// Une requête annulée (nouvelle frappe) ne doit pas afficher d'erreur.
			if ((err as DOMException).name !== 'AbortError') {
				suggestions = [];
				noResults = true;
			}
		} finally {
			loading = false;
		}
	}

	function handleInput(event: Event) {
		query = (event.target as HTMLInputElement).value;
		clearTimeout(debounceId);
		debounceId = setTimeout(() => search(query), 300);
	}

	function pick(suggestion: AddressSuggestion) {
		query = suggestion.formatted;
		onSelect(suggestion);
		suggestions = [];
		open = false;
		noResults = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!open || suggestions.length === 0) return;
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			activeIndex = (activeIndex + 1) % suggestions.length;
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			activeIndex = (activeIndex - 1 + suggestions.length) % suggestions.length;
		} else if (event.key === 'Enter' && activeIndex >= 0) {
			event.preventDefault();
			pick(suggestions[activeIndex]);
		} else if (event.key === 'Escape') {
			open = false;
		}
	}

	function handleClickOutside(event: MouseEvent) {
		if (open && containerEl && !containerEl.contains(event.target as Node)) {
			open = false;
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="relative" bind:this={containerEl}>
	<Label for={id}>{label}</Label>
	<Input
		{id}
		{name}
		type="text"
		autocomplete="off"
		{placeholder}
		value={query}
		oninput={handleInput}
		onkeydown={handleKeydown}
		onfocus={() => {
			if (suggestions.length > 0) open = true;
		}}
	/>
	{#if open}
		<div class="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
			{#if loading}
				<p class="px-3 py-2 text-sm text-muted-foreground">Recherche…</p>
			{:else if noResults}
				<p class="px-3 py-2 text-sm text-muted-foreground">
					Aucun résultat — saisissez l'adresse manuellement ci-dessous.
				</p>
			{:else}
				<ul class="max-h-60 overflow-auto py-1">
					{#each suggestions as suggestion, index (suggestion.formatted)}
						<li>
							<button
								type="button"
								class="w-full px-3 py-2 text-left text-sm hover:bg-accent {index === activeIndex
									? 'bg-accent'
									: ''}"
								onmousedown={(event) => event.preventDefault()}
								onclick={() => pick(suggestion)}
							>
								{suggestion.formatted}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>
