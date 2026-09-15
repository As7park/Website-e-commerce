<script lang="ts">
	import * as Form from '$shadcn/form';
	import { Input } from '$shadcn/input';
	import { Button } from '$shadcn/button';
	import { Textarea } from '$shadcn/textarea';
	import { filesFieldProxy, superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { createProductSchema } from '$lib/schema/products/productSchema';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import TaxonomyValuePicker from '$components/TaxonomyValuePicker.svelte';

	let { data } = $props();

	const createProduct = superForm(data.IcreateProductSchema, {
		validators: zodClient(createProductSchema),
		id: 'createProduct'
	});

	const {
		form: createProductData,
		enhance: createProductEnhance,
		message: createProductMessage
	} = createProduct;

	let DataPrice: number = $state(0);
	let DataStock: number = $state(0);
	let DataCompareAtPrice: string = $state('');

	let selectedTaxonomyValueIds: string[] = $state([]);

	const files = filesFieldProxy(createProduct, 'images');
	const { values } = files;

	// Conversion des données en nombres
	$effect(() => {
		$createProductData.price = Number(DataPrice);
		$createProductData.stock = Number(DataStock);
		$createProductData.compareAtPrice = DataCompareAtPrice === '' ? 0 : Number(DataCompareAtPrice);
	});

	$effect(() => {
		$createProductData.taxonomyValueIds = selectedTaxonomyValueIds;
	});

	// Redirection après succès
	$effect(() => {
		if ($createProductMessage === 'Product created successfully') {
			goto('/admin/products/');
			toast.success($createProductMessage);
		}
	});
</script>

<div class="ccc w-[100%]">
	<div class="m-5 p-5 border rounded w-[100%]">
		<form
			method="POST"
			enctype="multipart/form-data"
			action="?/createProduct"
			use:createProductEnhance
			class="space-y-4"
		>
			<div class="rtb">
				<div class="ccc" style="width: calc(100% - 320px);">
					<div class="w-[100%]">
						<Form.Field name="name" form={createProduct}>
							<Form.Control>
								<Form.Label>Name</Form.Label>
								<Input name="name" type="text" bind:value={$createProductData.name} />
							</Form.Control>
							<Form.FieldErrors />
						</Form.Field>
					</div>

					<div class="w-[100%]">
						<Form.Field name="price" form={createProduct}>
							<Form.Control>
								<Form.Label>Price</Form.Label>
								<Input name="price" type="number" bind:value={DataPrice} step="0.01" min="0.01" />
							</Form.Control>
							<Form.FieldErrors />
						</Form.Field>
					</div>

					<div class="w-[100%]">
						<Form.Field name="stock" form={createProduct}>
							<Form.Control>
								<Form.Label>Stock</Form.Label>
								<Input name="stock" type="number" bind:value={DataStock} />
							</Form.Control>
							<Form.FieldErrors />
						</Form.Field>
					</div>

					<div class="w-[100%]">
						<Form.Field name="description" form={createProduct}>
							<Form.Control>
								<Form.Label>Description</Form.Label>
								<Textarea name="description" bind:value={$createProductData.description} />
							</Form.Control>
							<Form.FieldErrors />
						</Form.Field>
					</div>

					<div class="w-[100%]">
						<Form.Field name="colorProduct" form={createProduct}>
							<Form.Control>
								<Form.Label>Color</Form.Label>
								<Input
									name="colorProduct"
									type="color"
									bind:value={$createProductData.colorProduct}
									class="w-16 h-10 p-0 border border-gray-300 rounded"
								/>
							</Form.Control>
							<Form.FieldErrors />
						</Form.Field>
					</div>

					<div class="w-[100%]">
						<Form.Field name="sku" form={createProduct}>
							<Form.Control>
								<Form.Label>Référence (SKU)</Form.Label>
								<Input name="sku" type="text" bind:value={$createProductData.sku} />
							</Form.Control>
							<Form.FieldErrors />
						</Form.Field>
					</div>

					<div class="w-[100%]">
						<Form.Field name="compareAtPrice" form={createProduct}>
							<Form.Control>
								<Form.Label>Prix barré (facultatif)</Form.Label>
								<Input
									name="compareAtPrice"
									type="number"
									bind:value={DataCompareAtPrice}
									step="0.01"
									min="0.01"
								/>
							</Form.Control>
							<Form.FieldErrors />
						</Form.Field>
					</div>

					<TaxonomyValuePicker
						taxonomies={data.taxonomies}
						bind:selectedIds={selectedTaxonomyValueIds}
					/>
				</div>
				<div class="ccc w-[300px]">
					<div class="p-4 pb-0 flex flex-row space-x-4 ccc">
						<div
							class="ccc w-[300px] h-[300px] flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg relative"
						>
							<input
								multiple
								bind:files={$values}
								name="images"
								accept="image/png, image/jpeg"
								type="file"
								class="absolute opacity-0 w-full h-full cursor-pointer z-10"
								style="transform: translate(50%, 50%); left: -50%; top: -50%;"
							/>
							<div class="text-center pointer-events-none">
								<svg
									class="mx-auto h-12 w-12 text-gray-400"
									stroke="currentColor"
									fill="none"
									viewBox="0 0 48 48"
									aria-hidden="true"
								>
									<path
										d="M28 8H20v12H8v8h12v12h8V28h12v-8H28V8z"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									></path>
								</svg>
								<div class="mt-2 text-sm text-gray-600">
									<label
										class="relative cursor-pointer rounded-md font-medium text-indigo-600 hover:text-indigo-500"
										for="file-input"
									>
										<span>Upload a file</span>
									</label>
								</div>
								<p class="text-xs text-gray-500">PNG, JPG up to 1MB</p>
							</div>
						</div>
						<div class="mt-3 flex flex-wrap gap-2 flex-1 w-[300px] rts">
							{#each $values as image}
								<div class="relative w-[65px] h-[65px]">
									<img
										src={URL.createObjectURL(image)}
										alt=""
										class="w-full h-full object-cover rounded"
									/>
								</div>
							{/each}
						</div>
						<Form.Field name="images" form={createProduct}>
							<Form.FieldErrors />
						</Form.Field>
					</div>
				</div>
			</div>

			<input
				type="hidden"
				name="taxonomyValueIds"
				bind:value={$createProductData.taxonomyValueIds}
			/>

			<Button type="submit">Save changes</Button>
		</form>
	</div>
</div>
