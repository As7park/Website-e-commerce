<script lang="ts">
	import Table from '$components/Table.svelte';
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
		{ key: 'createdAt', label: 'Date', formatter: formatDate }
	];

	const transactionActions = [
		{
			type: 'link' as const,
			name: 'facture',
			url: (item: { id: string }) => `/auth/settings/factures/${item.id}`,
			icon: Receipt,
			condition: (item: { hasFacture?: boolean }) => Boolean(item.hasFacture)
		},
		{
			type: 'link' as const,
			name: 'retour',
			url: (item: { id: string }) => `/auth/settings/returns/${item.id}`,
			icon: Undo2,
			condition: (item: { hasFacture?: boolean }) => data.returnsEnabled && Boolean(item.hasFacture)
		}
	];
</script>

<div class="ccc w-[100%]">
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
