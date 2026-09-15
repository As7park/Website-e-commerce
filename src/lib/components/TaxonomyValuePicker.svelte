<script lang="ts">
	/**
	 * Sélecteur générique de valeurs de taxonomie pour le formulaire produit
	 * (remplace à terme les blocs dédiés « Matière » / « Catégories »).
	 *
	 * `taxonomy.multiple = true` → cases à cocher (plusieurs valeurs possibles).
	 * `taxonomy.multiple = false` → sélection unique (ex: Matière).
	 */
	import Checkbox from '$shadcn/checkbox/checkbox.svelte';
	import { Label } from '$shadcn/label';
	import * as Select from '$shadcn/select';

	type TaxonomyValue = {
		id: string;
		value: string;
		label: string | null;
		code: string | null;
		parentId: string | null;
	};
	type Taxonomy = {
		id: string;
		name: string;
		type: string;
		multiple: boolean;
		values: TaxonomyValue[];
	};

	let {
		taxonomies,
		selectedIds = $bindable([])
	}: { taxonomies: Taxonomy[]; selectedIds: string[] } = $props();

	function isSelected(id: string) {
		return selectedIds.includes(id);
	}

	function toggleMultiple(id: string) {
		selectedIds = isSelected(id) ? selectedIds.filter((v) => v !== id) : [...selectedIds, id];
	}

	function singleSelected(taxonomyValueIds: string[]) {
		return selectedIds.find((id) => taxonomyValueIds.includes(id)) ?? 'none';
	}

	function setSingle(taxonomyValueIds: string[], value: string) {
		const withoutTaxonomy = selectedIds.filter((id) => !taxonomyValueIds.includes(id));
		selectedIds = value === 'none' ? withoutTaxonomy : [...withoutTaxonomy, value];
	}
</script>

<div class="w-[100%] space-y-4">
	{#each taxonomies as taxonomy (taxonomy.id)}
		{@const ids = taxonomy.values.map((v) => v.id)}
		<div class="w-[100%]">
			<h4 class="scroll-m-20 text-lg font-semibold tracking-tight">{taxonomy.name}</h4>
			{#if taxonomy.values.length === 0}
				<p class="text-sm text-muted-foreground">Aucune valeur définie.</p>
			{:else if taxonomy.multiple}
				{#each taxonomy.values as value (value.id)}
					<div class="my-2 flex items-center space-x-2">
						<Checkbox
							id={`taxonomy-value-${value.id}`}
							checked={isSelected(value.id)}
							onCheckedChange={() => toggleMultiple(value.id)}
						/>
						<Label for={`taxonomy-value-${value.id}`} class="flex items-center gap-2 text-sm font-medium">
							{#if taxonomy.type === 'COLOR' && value.code}
								<span
									class="inline-block w-4 h-4 rounded-full border"
									style={`background-color:${value.code}`}
								></span>
							{/if}
							{value.label || value.value}
						</Label>
					</div>
				{/each}
			{:else}
				<Select.Root
					type="single"
					value={singleSelected(ids)}
					onValueChange={(v) => setSingle(ids, v)}
				>
					<Select.Trigger class="w-full">
						<span>
							{taxonomy.values.find((v) => v.id === singleSelected(ids))?.label ??
								taxonomy.values.find((v) => v.id === singleSelected(ids))?.value ??
								'Aucune'}
						</span>
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="none">Aucune</Select.Item>
						{#each taxonomy.values as value (value.id)}
							<Select.Item value={value.id}>{value.label || value.value}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			{/if}
		</div>
	{/each}
</div>
