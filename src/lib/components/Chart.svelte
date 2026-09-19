<script lang="ts">
	import * as Chart from '$lib/components/shadcn/ui/chart/index.js';
	import { AreaChart } from 'layerchart';

	type Point = {
		label: string;
		value: number;
	};

	let {
		data = [],
		title = 'Transactions',
		valueLabel = 'Montant'
	}: {
		data?: Point[];
		title?: string;
		valueLabel?: string;
	} = $props();

	const points = $derived(
		(Array.isArray(data) ? data : []).map((item) => ({
			label: item.label,
			value: Number(item.value) || 0
		}))
	);

	const chartConfig = $derived({
		value: {
			label: valueLabel,
			color: 'var(--chart-1)'
		}
	} satisfies Chart.ChartConfig);
</script>

<div class="flex h-full w-full flex-col">
	{#if title}
		<p class="mb-2 text-center text-sm font-medium">{title}</p>
	{/if}
	{#if points.length === 0}
		<p class="text-muted-foreground m-auto text-sm">Aucune donnée</p>
	{:else}
		<Chart.Container config={chartConfig} class="aspect-auto h-full min-h-[180px] w-full">
			<AreaChart
				data={points}
				x="label"
				axis="x"
				series={[
					{
						key: 'value',
						label: chartConfig.value.label,
						color: chartConfig.value.color
					}
				]}
			>
				{#snippet tooltip()}
					<Chart.Tooltip />
				{/snippet}
			</AreaChart>
		</Chart.Container>
	{/if}
</div>
