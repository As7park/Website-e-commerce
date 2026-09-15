<script lang="ts">
	import { page } from '$app/stores';
	import { get } from 'svelte/store';

	import * as Form from '$shadcn/form';
	import { Input } from '$shadcn/input';
	import { Button } from '$shadcn/button';
	import * as Sheet from '$shadcn/sheet/index.js';
	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { updateCategorySchema } from '$lib/schema/categories/deleteCategorySchema.js';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';

	let { data } = $props();

	let id: string = $state();

	// Initialisation du formulaire superForm
	const updateCategory = superForm(data.IupdateCategorySchema, {
		validators: zodClient(updateCategorySchema),
		id: 'updateCategory'
	});

	const {
		form: updateCategoryData,
		enhance: updateCategoryEnhance,
		message: updateCategoryMessage
	} = updateCategory;

	$effect(() => {
		const pageData = get(page);
		id = pageData.params.id;
		//console.log('Category ID on mount:', id);
	});

	$effect(() => {
		if ($updateCategoryMessage === 'Category updated successfully') {
			toast.success($updateCategoryMessage);
			setTimeout(() => goto('/admin/products'), 0);
		}
	});
</script>

<div class="ccc">
	<div class="m-5 p-5 border w-[400px]">
		<form method="POST" action="?/updateCategory" use:updateCategoryEnhance class="space-y-4">
			<div class="ccs mt-5">
				<div class="w-[100%]">
					<Form.Field name="name" form={updateCategory}>
						<Form.Control>
							<Form.Label>Name</Form.Label>
							<Input name="name" type="text" bind:value={$updateCategoryData.name} />
						</Form.Control>
						<Form.FieldErrors />
					</Form.Field>
				</div>
			</div>
			<input type="hidden" name="id" value={id} />
			<Button type="submit">Save changes</Button>
		</form>
	</div>
</div>
