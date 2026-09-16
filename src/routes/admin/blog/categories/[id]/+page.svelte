<script lang="ts">
	import { untrack } from 'svelte';
	import * as Form from '$shadcn/form';
	import { Input } from '$shadcn/input';
	import { Button } from '$shadcn/button';
	import { Textarea } from '$shadcn/textarea/index.js';

	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { updateBlogCategorySchema } from '$lib/schema/BlogPost/categoriesSchema';
	import { goto } from '$app/navigation';

	let { data } = $props();

	// Initialiser le formulaire superForm
	const updateBlogCategory = superForm(untrack(() => data.updateCategoryForm), {
		validators: zodClient(updateBlogCategorySchema),
		id: 'updateBlogCategory'
	});

	// Déstructurer les variables utiles
	const {
		form: updateCategoryForm,
		enhance: updateCategoryEnhance,
		message: updateCategoryMessage
	} = updateBlogCategory;

	$effect(() => {
		if ($updateCategoryMessage === 'Category updated successfully') {
			toast.success($updateCategoryMessage);
			setTimeout(() => goto('/admin/blog/'), 1000);
		}
	});
</script>

<h1>Update Category</h1>

<form method="POST" action="?/updateCategory" use:updateCategoryEnhance class="space-y-4">
	<!-- Champ ID caché pour la mise à jour -->
	<input type="hidden" name="id" value={$updateCategoryForm.id} />

	<Form.Field name="name" form={updateBlogCategory}>
		<Form.Control>
			<Form.Label>Category Name</Form.Label>
			<Input name="name" type="text" bind:value={$updateCategoryForm.name} />
		</Form.Control>
		<Form.FieldErrors />
	</Form.Field>
	<Form.Field name="description" form={updateBlogCategory}>
		<Form.Control>
			<Form.Label>Category Name</Form.Label>
			<Textarea
				name="description"
				bind:value={$updateCategoryForm.description as string}
				placeholder="Type your message here."
			/>
		</Form.Control>
		<Form.FieldErrors />
	</Form.Field>
	<Button type="submit">Save Changes</Button>
</form>
