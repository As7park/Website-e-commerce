<script lang="ts">
	import Table from '$components/Table.svelte';
	import { deleteProductSchema } from '$lib/schema/products/productSchema.js';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import Pencil from 'lucide-svelte/icons/pencil';
	import Trash from 'lucide-svelte/icons/trash';
	import { deleteTaxonomySchema } from '$lib/schema/taxonomies/taxonomySchema.js';
	import { optimizedImageUrl } from '$lib/utils/cloudinaryUrl';

	// Props
	let { data } = $props();

	// `$derived`, pas `$state` : `products` doit suivre `data.products` à
	// chaque rechargement de `load()` (pagination, recherche, tri serveur),
	// pas rester figé sur sa valeur au premier montage.
	let products = $derived(data?.products ?? []);

	let productsData = $derived.by(() =>
		products.map((product) => ({
			...product,
			// Catégories : extraire les noms
			categories:
				product.categories?.map((cat) => cat.category?.name || 'Unknown').join(', ') ||
				'No category',
			materialName: product.material?.name ?? '—',
			// Première image ou placeholder
			images: `<img class='w-20 h-20' src='${optimizedImageUrl(product.images[0] ?? '', 80)}' alt='${product.name}' />`,
			// Description tronquée
			description:
				product.description?.length > 20
					? `${product.description.slice(0, 20)}...`
					: product.description || 'No description available'
		}))
	);

	// Form handling with superForm
	const deleteProduct = superForm(data?.IdeleteProductSchema ?? {}, {
		validators: zodClient(deleteProductSchema),
		id: 'deleteProduct'
	});

	const {
		form: deleteProductData,
		enhance: deleteProductEnhance,
		message: deleteProductMessage
	} = deleteProduct;

	// Define table columns
	const productColumns = $state([
		{ key: 'stock', label: 'Stock' },
		{ key: 'name', label: 'Nom' },
		{ key: 'price', label: 'Prix' },
		{ key: 'categories', label: 'Catégories' },
		{ key: 'materialName', label: 'Matière' },
		{ key: 'images', label: 'Images' },
		{ key: 'description', label: 'Description' }
	]);

	// Define actions with icons
	const productActions = $state([
		{
			type: 'link',
			name: 'edit',
			url: (item: any) => `/admin/products/${item.id}`,
			icon: Pencil
		},
		{
			type: 'form',
			name: 'delete',
			url: '?/deleteProduct',
			dataForm: deleteProductData.id,
			enhanceAction: deleteProductEnhance,
			icon: Trash
		}
	]);

	// Show toast on delete message
	$effect(() => {
		if ($deleteProductMessage) {
			toast.success($deleteProductMessage);
		}
	});

	// Form handling with superForm
	const deleteTaxonomy = superForm(data?.IdeleteTaxonomySchema ?? {}, {
		validators: zodClient(deleteTaxonomySchema),
		id: 'deleteTaxonomy'
	});

	const {
		form: deleteTaxonomyData,
		enhance: deleteTaxonomyEnhance,
		message: deleteTaxonomyMessage
	} = deleteTaxonomy;

	let taxonomiesData = $derived(
		(data?.taxonomies ?? []).map((taxonomy: any) => ({
			...taxonomy,
			valuesCount: taxonomy._count?.values ?? 0
		}))
	);

	// Table columns
	const taxonomyColumns = [
		{ key: 'name', label: 'Nom' },
		{ key: 'slug', label: 'Slug' },
		{ key: 'type', label: 'Type' },
		{ key: 'valuesCount', label: 'Valeurs' }
	];

	// Table actions
	const taxonomyActions = [
		{
			type: 'link',
			name: 'edit',
			url: (item: any) => `/admin/products/taxonomies/${item.id}`,
			icon: Pencil
		},
		{
			type: 'form',
			name: 'delete',
			url: '?/deleteTaxonomy',
			dataForm: deleteTaxonomyData.id,
			enhanceAction: deleteTaxonomyEnhance,
			icon: Trash
		}
	];

	// Show toast on delete message
	$effect(() => {
		if ($deleteTaxonomyMessage) {
			toast.success($deleteTaxonomyMessage);
		}
	});
</script>

<h1 class="m-5 text-4xl">Gestion produits</h1>

<!-- UI Table -->
<div class="ccc w-[100%]">
	<Table
		name="Produits"
		columns={productColumns}
		data={productsData ?? []}
		actions={productActions}
		addLink="/admin/products/create"
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

<div class="ccc w-[100%]">
	<Table
		name="Taxonomies"
		columns={taxonomyColumns}
		data={taxonomiesData}
		actions={taxonomyActions}
		addLink="/admin/products/taxonomies/create"
	/>
</div>
