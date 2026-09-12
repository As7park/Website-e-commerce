<script lang="ts">
	import { Button, buttonVariants } from '$shadcn/button';
	import { cn } from '$lib/components/shadcn/utils.js';
	import * as Table from '$shadcn/table';
	import TableRow from '$shadcn/table/table-row.svelte';
	import TableCell from '$shadcn/table/table-cell.svelte';
	import { Input } from '$shadcn/input';
	import * as Popover from '$shadcn/popover/index.js';
	import * as RadioGroup from '$shadcn/radio-group/index.js';
	import * as DropdownMenu from '$shadcn/dropdown-menu/index.js';
	import * as AlertDialog from '$shadcn/alert-dialog/index.js';
	import { Label } from '$shadcn/label';
	import * as Tooltip from '$shadcn/tooltip/index.js';

	import type { Component } from 'svelte';
	import type { Action } from 'svelte/action';
	import ChevronDown from 'lucide-svelte/icons/chevron-down';
	import { Plus } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { page as appPage } from '$app/state';

	type TableColumn = {
		key: string;
		label: string;
		formatter?: (value: unknown) => unknown;
	};

	type TableItem = {
		id: string;
		[key: string]: unknown;
	};

	type TableAction =
		| {
				type: 'link';
				name: string;
				url: (item: TableItem) => string;
				icon?: Component;
				condition?: (item: TableItem) => boolean;
		  }
		| {
				type: 'form';
				name: string;
				url: string;
				enhanceAction: Action<HTMLFormElement>;
				icon?: Component;
				condition?: (item: TableItem) => boolean;
		  };

	/**
	 * Pagination pilotée par le serveur : `data` est déjà la bonne page,
	 * déjà filtrée/triée par la route. Sans ce prop (défaut), la table garde
	 * son comportement 100% client historique (recherche/tri/pagination sur
	 * la totalité de `data`) — c'est le cas de la plupart des tables encore
	 * aujourd'hui (blog, promo, contacts, factures du compte).
	 */
	interface ServerPaging {
		page: number;
		perPage: number;
		total: number;
		search: string;
		sort?: string;
		dir?: 'asc' | 'desc';
	}

	interface Props {
		data: TableItem[];
		columns: TableColumn[];
		name: string;
		actions?: TableAction[] | null;
		addLink?: string | null;
		server?: ServerPaging | null;
	}

	let { data, columns, name, actions = null, addLink = null, server = null }: Props = $props();

	let dialogOpenId = $state<string | null>(null);
	let searchQuery = $state(server?.search ?? '');
	let currentPage = $state(server?.page ?? 1);
	let itemsPerPage = $state(server?.perPage ?? 5);

	const optionPage = $state([
		{ label: '5', value: 5 },
		{ label: '10', value: 10 },
		{ label: '15', value: 15 },
		{ label: '20', value: 20 }
	]);

	let itemsPerPageString = $state(String(server?.perPage ?? 5));
	let sortColumn = $state(server?.sort ?? '');
	let sortDirection = $state(server?.dir ?? 'asc');
	let columnsVisibility = $state(
		columns.reduce<Record<string, boolean>>((acc, col) => {
			acc[col.key] = true;
			return acc;
		}, {})
	);

	// Recharge `currentPage`/`itemsPerPage`/`searchQuery`/tri depuis le prop
	// `server` à chaque nouvelle réponse du `load()` (page suivante, retour
	// navigateur, etc.) — sans ça l'état local resterait figé sur la première
	// valeur reçue.
	$effect(() => {
		if (!server) return;
		currentPage = server.page;
		itemsPerPage = server.perPage;
		itemsPerPageString = String(server.perPage);
		sortColumn = server.sort ?? '';
		sortDirection = server.dir ?? 'asc';
		searchQuery = server.search;
	});

	/**
	 * Fusionne des paramètres dans l'URL courante et recharge `load()` —
	 * seul mécanisme de mise à jour en mode serveur (recherche, tri,
	 * changement de page/taille de page).
	 */
	function updateServerUrl(patch: Record<string, string | number | null | undefined>) {
		const url = new URL(appPage.url);
		for (const [key, value] of Object.entries(patch)) {
			if (value === null || value === undefined || value === '') url.searchParams.delete(key);
			else url.searchParams.set(key, String(value));
		}
		goto(`${url.pathname}${url.search}`, { keepFocus: true, noScroll: true, invalidateAll: true });
	}

	// Recherche : debounce avant de recharger depuis le serveur. Le garde
	// `query === server.search` évite de redéclencher une navigation quand ce
	// même effet vient de resynchroniser `searchQuery` depuis un `server` frais.
	let searchDebounce: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		const query = searchQuery;
		if (!server) return;
		if (query === server.search) return;
		clearTimeout(searchDebounce);
		searchDebounce = setTimeout(() => updateServerUrl({ search: query || null, page: 1 }), 400);
		return () => clearTimeout(searchDebounce);
	});

	const sortItems = (column: string) => {
		if (server) {
			const nextDir = server.sort === column && server.dir === 'asc' ? 'desc' : 'asc';
			updateServerUrl({ sort: column, dir: nextDir });
			return;
		}

		if (sortColumn === column) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = column;
			sortDirection = 'asc';
		}

		data = [...data].sort((a, b) => {
			const aValue = a[column];
			const bValue = b[column];
			const av = typeof aValue === 'string' ? aValue.toLowerCase() : String(aValue ?? '');
			const bv = typeof bValue === 'string' ? bValue.toLowerCase() : String(bValue ?? '');

			return av.localeCompare(bv) * (sortDirection === 'asc' ? 1 : -1);
		});
	};

	// Dérivées, jamais réassignées à la main : deux `$effect` séparés qui
	// écrivaient tous deux dans `filteredItems`/`paginatedItems` (l'un sur
	// data/searchQuery/currentPage/itemsPerPage, l'autre en cascade depuis
	// `itemsPerPageString`) se marchaient dessus et levaient `UpdatedAtError`,
	// ce qui interrompait le cycle réactif de Svelte avant que d'autres effets
	// (dont l'ouverture de l'AlertDialog de suppression) n'aient pu s'exécuter.
	let filteredItems = $derived(
		data.filter((item) =>
			Object.values(item).some((value) =>
				String(value).toLowerCase().includes(searchQuery.toLowerCase())
			)
		)
	);
	// En mode serveur, `data` est déjà la page courante, déjà filtrée/triée :
	// pas de nouveau filtrage/slice local.
	let paginatedItems = $derived.by(() => {
		if (server) return data;
		const start = (currentPage - 1) * itemsPerPage;
		const end = start + itemsPerPage;
		return filteredItems.slice(start, end);
	});
	let totalPages = $derived(
		server
			? Math.max(1, Math.ceil(server.total / server.perPage))
			: Math.max(1, Math.ceil(filteredItems.length / itemsPerPage))
	);

	const changePage = (targetPage: number) => {
		if (server) {
			updateServerUrl({ page: targetPage });
			return;
		}
		currentPage = targetPage;
	};

	const changeItemsPerPage = (items: number) => {
		if (server) {
			updateServerUrl({ perPage: items, page: 1 });
			return;
		}
		itemsPerPage = items;
		currentPage = 1;
	};

	const deleteItem = (id: string) => {
		setTimeout(() => {
			// En mode serveur, `use:enhance` recharge déjà `load()` après le
			// succès de l'action : `data` sera remplacé par une page à jour,
			// pas besoin (et pas cohérent avec `total`) de la trancher ici.
			if (!server) {
				data = data.filter((item) => item.id !== id);
			}
			dialogOpenId = null;
		}, 10);
	};

	$effect(() => {
		const newItems = parseInt(itemsPerPageString, 10);
		if (newItems !== itemsPerPage) {
			changeItemsPerPage(newItems);
		}
	});
</script>

<div class="rcs w-[90%]">
	<div class="w-full mt-10">
		<div class="border rounded p-2">
			<h2 class="text-2xl font-bold mb-5">{name}</h2>

			<div class="rcb mb-5 w-full">
				<div class="flex items-center space-x-4">
					<Input
						type="text"
						placeholder="Cherchez dans le tableau"
						class="max-w-xs"
						bind:value={searchQuery}
					/>

					<Popover.Root>
						<Popover.Trigger class="border rounded px-2 py-1">
							{itemsPerPage}
						</Popover.Trigger>
						<Popover.Content class="p-4 border rounded w-48 bg-white shadow-lg">
							<div class="mb-2 font-medium">nombre d'items :</div>
							<RadioGroup.Root bind:value={itemsPerPageString} class="space-y-2">
								{#each optionPage as option}
									<div class="flex items-center space-x-2">
										<RadioGroup.Item value={String(option.value)} id={'option' + option.value} />
										<Label for={'option' + option.value}>{option.label}</Label>
									</div>
								{/each}
							</RadioGroup.Root>
						</Popover.Content>
					</Popover.Root>

					<DropdownMenu.Root>
						<DropdownMenu.Trigger>
							<Button variant="outline" class="ml-auto">
								Colonnes <ChevronDown class="ml-2 size-4" />
							</Button>
						</DropdownMenu.Trigger>
						<DropdownMenu.Content align="end">
							{#each columns as column (column.key)}
								<DropdownMenu.CheckboxItem
									class="capitalize"
									checked={columnsVisibility[column.key]}
									onCheckedChange={(value) => {
										columnsVisibility = {
											...columnsVisibility,
											[column.key]: value
										};
									}}
								>
									{column.label}
								</DropdownMenu.CheckboxItem>
							{/each}
						</DropdownMenu.Content>
					</DropdownMenu.Root>

					{#if addLink}
						<Button class="ml-auto" href={addLink} aria-label="Ajouter">
							<Plus class="size-4" />
						</Button>
					{/if}
				</div>
			</div>

			<div class="border rounded">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							{#each columns.filter((col) => columnsVisibility[col.key]) as column}
								<Table.Head class="border-r border-r-gray-800 pr-2">
									<div class="rcb">
										{column.label}
										<button onclick={() => sortItems(column.key)}>
											<ChevronDown class="cursor-pointer" />
										</button>
									</div>
								</Table.Head>
							{/each}
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each paginatedItems as item (item.id)}
							<TableRow>
								{#each columns.filter((col) => columnsVisibility[col.key]) as column}
									<td class="border border-gray-300 p-2">
										{#if column.key === 'images'}
											{@html typeof item[column.key] === 'string' ? item[column.key] : ''}
										{:else if column.formatter}
											<!-- Si la colonne a un formatter, appliquez-le -->
											{column.formatter(item[column.key])}
										{:else}
											<!-- Sinon, affichez la valeur brute -->
											{item[column.key]}
										{/if}
									</td>
								{/each}

								{#if actions && actions.length > 0}
									{#each actions as action}
										<TableCell>
											{#if (!action.condition || action.condition(item)) && action.type === 'link'}
												<Tooltip.Provider>
													<Tooltip.Root>
														<Tooltip.Trigger>
															{#snippet child({ props })}
																<a
																	{...props}
																	href={action.url(item)}
																	class="border rounded p-2 inline-flex items-center"
																	aria-label={action.name}
																>
																	{#if action.icon}
																		<action.icon class="h-4 w-4 inline" />
																	{/if}
																</a>
															{/snippet}
														</Tooltip.Trigger>
														<Tooltip.Content>
															<p>{action.name}</p>
														</Tooltip.Content>
													</Tooltip.Root>
												</Tooltip.Provider>
											{:else if (!action.condition || action.condition(item)) && action.type === 'form'}
												<AlertDialog.Root
													open={dialogOpenId === item.id}
													onOpenChange={(open) => {
														dialogOpenId = open ? item.id : null;
													}}
												>
													<AlertDialog.Trigger
														class={cn(buttonVariants({ variant: 'outline' }), 'm-1 p-1 text-xs')}
													>
														{#if action.icon}
															<action.icon class="h-4 w-4 inline" />
														{/if}
													</AlertDialog.Trigger>

													<AlertDialog.Content>
														<AlertDialog.Header>
															<AlertDialog.Title>Are you absolutely sure?</AlertDialog.Title>
															<AlertDialog.Description>
																This action cannot be undone. This will permanently delete the item.
															</AlertDialog.Description>
														</AlertDialog.Header>
														<AlertDialog.Footer>
															<AlertDialog.Cancel onclick={() => (dialogOpenId = null)}
																>Cancel</AlertDialog.Cancel
															>

															<form method="POST" action={action.url} use:action.enhanceAction>
																<input type="hidden" name="id" value={item.id} />
																<AlertDialog.Action
																	type="submit"
																	onclick={() => deleteItem(item.id)}
																>
																	Continue
																</AlertDialog.Action>
															</form>
														</AlertDialog.Footer>
													</AlertDialog.Content>
												</AlertDialog.Root>
											{/if}
										</TableCell>
									{/each}
								{/if}
							</TableRow>
						{/each}
					</Table.Body>
				</Table.Root>
			</div>

			<div class="pagination-controls mt-4 rce">
				{#if currentPage > 1}
					<Button onclick={() => changePage(currentPage - 1)}>Previous</Button>
				{/if}
				<div class="">
					{#each Array(totalPages) as _, pageIndex}
						<Button class="mx-1" onclick={() => changePage(pageIndex + 1)}>{pageIndex + 1}</Button>
					{/each}
				</div>
				{#if currentPage < totalPages}
					<Button onclick={() => changePage(currentPage + 1)}>Next</Button>
				{/if}
			</div>
		</div>
	</div>
</div>
