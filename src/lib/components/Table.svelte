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
	import * as Pagination from '$shadcn/pagination/index.js';
	import { Label } from '$shadcn/label';
	import * as Tooltip from '$shadcn/tooltip/index.js';

	import type { Component } from 'svelte';
	import type { Action } from 'svelte/action';
	import ChevronDown from 'lucide-svelte/icons/chevron-down';
	import { Plus, Search, X, SearchX, LoaderCircle, ChevronLeft, ChevronRight } from 'lucide-svelte';
	import { goto, beforeNavigate } from '$app/navigation';
	import { page as appPage, navigating } from '$app/state';

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

	// Sans ça, un clic sur une action de ligne (edit, etc.) pendant la fenêtre
	// de debounce se fait doubler par le rechargement de recherche : les deux
	// navigations sont en course, et SvelteKit applique la dernière déclenchée
	// (celle de la recherche), ramenant l'utilisateur sur la liste au lieu de
	// la page cliquée. Annuler le timer dès qu'une navigation démarre laisse
	// la navigation volontaire de l'utilisateur gagner systématiquement.
	beforeNavigate(() => {
		clearTimeout(searchDebounce);
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
	// `Pagination.Root` (bits-ui) calcule lui-même la fenêtre de pages visibles
	// (avec ellipses) à partir de `count`/`perPage` — évite de rendre un
	// bouton par page, illisible et coûteux en DOM dès quelques dizaines de
	// pages (tables de plusieurs milliers de lignes).
	let paginationCount = $derived(server ? server.total : filteredItems.length);
	let paginationPerPage = $derived(server ? server.perPage : itemsPerPage);
	let rangeStart = $derived(paginationCount === 0 ? 0 : (currentPage - 1) * paginationPerPage + 1);
	let rangeEnd = $derived(Math.min(currentPage * paginationPerPage, paginationCount));
	// Uniquement en mode serveur : le mode client ne navigue jamais (tri/page/
	// recherche recalculés en mémoire), rien à faire attendre.
	let isNavigating = $derived(Boolean(server && navigating.to));

	let visibleColumns = $derived(columns.filter((col) => columnsVisibility[col.key]));

	let jumpToPageValue = $state('');
	function submitJumpToPage(event: SubmitEvent) {
		event.preventDefault();
		const target = Math.floor(Number(jumpToPageValue));
		if (Number.isFinite(target) && target >= 1 && target <= totalPages) {
			changePage(target);
		}
		jumpToPageValue = '';
	}

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

<div class="rcs w-full max-w-full px-2 sm:w-[90%] sm:px-0">
	<div class="w-full mt-10">
		<div class="border rounded p-2 sm:p-4">
			<h2 class="text-2xl font-bold mb-5">{name}</h2>

			<div class="flex flex-col gap-3 mb-5 w-full sm:flex-row sm:items-center sm:justify-between">
				<div class="relative w-full sm:max-w-xs">
					<Search class="text-muted-foreground pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2" />
					<Input
						type="text"
						placeholder="Cherchez dans le tableau"
						class="w-full pl-8 {searchQuery ? 'pr-8' : ''}"
						bind:value={searchQuery}
					/>
					{#if searchQuery}
						<button
							type="button"
							class="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2"
							aria-label="Effacer la recherche"
							onclick={() => (searchQuery = '')}
						>
							<X class="size-4" />
						</button>
					{/if}
				</div>

				<div class="flex flex-wrap items-center gap-2 sm:justify-end">
					<Popover.Root>
						<Popover.Trigger class={cn(buttonVariants({ variant: 'outline' }))}>
							{itemsPerPage} / page
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
							<Button variant="outline">
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
						<Button href={addLink} aria-label="Ajouter">
							<Plus class="size-4" />
						</Button>
					{/if}
				</div>
			</div>

			{#snippet actionButton(item: TableItem, action: TableAction)}
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
						<AlertDialog.Trigger class={cn(buttonVariants({ variant: 'outline' }), 'm-1 p-1 text-xs')}>
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
								<AlertDialog.Cancel onclick={() => (dialogOpenId = null)}>Cancel</AlertDialog.Cancel>

								<form method="POST" action={action.url} use:action.enhanceAction>
									<input type="hidden" name="id" value={item.id} />
									<AlertDialog.Action type="submit" onclick={() => deleteItem(item.id)}>
										Continue
									</AlertDialog.Action>
								</form>
							</AlertDialog.Footer>
						</AlertDialog.Content>
					</AlertDialog.Root>
				{/if}
			{/snippet}

			{#if paginatedItems.length === 0}
				<div class="flex flex-col items-center justify-center gap-3 rounded border py-16 text-center">
					<SearchX class="text-muted-foreground size-10" />
					<div>
						<p class="font-medium">Aucun résultat</p>
						<p class="text-muted-foreground text-sm">
							{searchQuery
								? `Rien ne correspond à « ${searchQuery} ».`
								: "Il n'y a rien à afficher pour le moment."}
						</p>
					</div>
					{#if searchQuery}
						<Button variant="outline" onclick={() => (searchQuery = '')}>Effacer la recherche</Button>
					{/if}
				</div>
			{:else}

			<div class="relative">
				{#if isNavigating}
					<div
						class="bg-background/60 absolute inset-0 z-10 flex items-center justify-center rounded"
					>
						<LoaderCircle class="text-muted-foreground size-6 animate-spin" />
					</div>
				{/if}

				<!-- Vue tableau (écrans md et plus) -->
				<div class="border rounded hidden overflow-x-auto md:block">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							{#each visibleColumns as column}
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
								{#each visibleColumns as column}
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
											{@render actionButton(item, action)}
										</TableCell>
									{/each}
								{/if}
							</TableRow>
						{/each}
					</Table.Body>
				</Table.Root>
				</div>

				<!-- Vue cartes (mobile, sous md) : un tableau large avec plusieurs
				     colonnes force un scroll horizontal illisible sur petit écran ;
				     une carte par ligne (libellé/valeur empilés) reste lisible. -->
				<div class="space-y-3 md:hidden">
					{#each paginatedItems as item (item.id)}
						<div class="rounded border p-3">
							<dl class="space-y-1.5">
								{#each visibleColumns as column}
									<div class="flex items-baseline justify-between gap-3">
										<dt class="text-muted-foreground text-xs shrink-0">{column.label}</dt>
										<dd class="text-sm text-right break-words">
											{#if column.key === 'images'}
												{@html typeof item[column.key] === 'string' ? item[column.key] : ''}
											{:else if column.formatter}
												{column.formatter(item[column.key])}
											{:else}
												{item[column.key]}
											{/if}
										</dd>
									</div>
								{/each}
							</dl>

							{#if actions && actions.length > 0}
								<div class="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
									{#each actions as action}
										{@render actionButton(item, action)}
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
			{/if}

			{#if paginatedItems.length > 0}
				<div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<p class="text-muted-foreground text-sm">
						{rangeStart}–{rangeEnd} sur {paginationCount} résultat{paginationCount > 1 ? 's' : ''}
					</p>

					<div class="flex flex-col items-center gap-3 sm:flex-row">
						{#if totalPages > 1}
							<Pagination.Root
								count={paginationCount}
								perPage={paginationPerPage}
								page={currentPage}
								siblingCount={1}
								onPageChange={changePage}
							>
								{#snippet children({ pages })}
									<Pagination.Content class="flex-wrap">
										<Pagination.Item>
											<Pagination.PrevButton class="w-9 px-0">
												<ChevronLeft class="size-4" />
												<span class="sr-only">Page précédente</span>
											</Pagination.PrevButton>
										</Pagination.Item>
										{#each pages as page (page.key)}
											<Pagination.Item>
												{#if page.type === 'ellipsis'}
													<Pagination.Ellipsis />
												{:else}
													<Pagination.Link {page} isActive={page.value === currentPage} />
												{/if}
											</Pagination.Item>
										{/each}
										<Pagination.Item>
											<Pagination.NextButton class="w-9 px-0">
												<ChevronRight class="size-4" />
												<span class="sr-only">Page suivante</span>
											</Pagination.NextButton>
										</Pagination.Item>
									</Pagination.Content>
								{/snippet}
							</Pagination.Root>
						{/if}

						{#if totalPages > 9}
							<form class="flex items-center gap-1.5" onsubmit={submitJumpToPage}>
								<Label for="table-jump-to-page" class="text-muted-foreground text-xs whitespace-nowrap">
									Aller à la page
								</Label>
								<Input
									id="table-jump-to-page"
									type="number"
									min="1"
									max={totalPages}
									class="h-8 w-16"
									bind:value={jumpToPageValue}
								/>
								<Button type="submit" variant="outline" size="sm">Go</Button>
							</form>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
