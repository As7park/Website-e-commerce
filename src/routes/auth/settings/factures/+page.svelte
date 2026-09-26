<script lang="ts">
	import Table from '$components/Table.svelte';
	import type { TableItem } from '$components/Table.svelte';
	import { formatDate } from '$lib/utils/formatDate';
	import { formatMoney } from '$lib/utils/formatMoney';
	import { formatOrderStatus } from '$lib/utils/formatOrderStatus';
	import Receipt from 'lucide-svelte/icons/receipt';
	import Undo2 from 'lucide-svelte/icons/undo-2';

	let { data } = $props();

	const userColumns = [
		{ key: 'invoiceNumber', label: 'N°' },
		{
			key: 'amount',
			label: 'Montant',
			formatter: (value: unknown) => formatMoney(typeof value === 'number' ? value : Number(value))
		},
		{ key: 'customer_details_name', label: 'Destinataire' },
		{
			key: 'status',
			label: 'Statut',
			formatter: (value: unknown) => formatOrderStatus(String(value)).label
		},
		{ key: 'createdAt', label: 'Date', formatter: (value: unknown) => formatDate(String(value)) }
	];

	const transactionActions = [
		{
			type: 'link' as const,
			name: 'facture',
			url: (item: { id: string }) => `/auth/settings/factures/${item.id}`,
			icon: Receipt,
			condition: (item: TableItem) => Boolean(item.hasFacture)
		},
		{
			type: 'link' as const,
			name: 'retour',
			url: (item: { id: string }) => `/auth/settings/returns/${item.id}`,
			icon: Undo2,
			condition: (item: TableItem) => data.returnsEnabled && Boolean(item.hasFacture)
		}
	];
</script>

<header class="shop-page-head">
	<h1 class="shop-page-title">Commandes & factures</h1>
	<p class="shop-page-lead">Retrouvez vos commandes, leur suivi et vos factures.</p>
</header>

<div class="w-full">
	<Table
		name="Factures"
		columns={userColumns}
		data={data.transactions ?? []}
		actions={transactionActions}
		server={{
			page: data.page,
			perPage: data.perPage,
			total: data.total,
			search: data.search,
			sort: data.sort,
			dir: data.dir
		}}
	/>
</div>
