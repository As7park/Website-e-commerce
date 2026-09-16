<script lang="ts">
	import { untrack } from 'svelte';
	import * as Form from '$shadcn/form';
	import { Textarea } from '$shadcn/textarea';
	import { Input } from '$shadcn/input';
	import { Button } from '$shadcn/button';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { createBlogCategorySchema } from '$lib/schema/BlogPost/categoriesSchema.js';
	import { goto } from '$app/navigation';

	let { data } = $props();

	const createBlogCategory = superForm(untrack(() => data?.createCategoryForm ?? {}), {
		validators: zodClient(createBlogCategorySchema),
		id: 'createBlogCategory'
	});

	const {
		form: createCategoryForm,
		enhance: createCategoryEnhance,
		message: createCategoryMessage
	} = createBlogCategory;

	$effect(() => {
		if ($createCategoryMessage === 'Category created successfully') {
			toast.success($createCategoryMessage), setTimeout(() => goto('/admin/blog/'), 0);
		}
	});
</script>

<h1>Manage Categories</h1>

<!-- Form to create category -->
<form method="POST" action="?/createCategory" use:createCategoryEnhance>
	<Form.Field name="name" form={createBlogCategory}>
		<Form.Control>
			<Form.Label>Category Name</Form.Label>
			<Input name="name" type="text" bind:value={$createCategoryForm.name} />
		</Form.Control>
		<Form.FieldErrors />
	</Form.Field>

	<Form.Field name="description" form={createBlogCategory}>
		<Form.Control>
			<Form.Label>Category Name</Form.Label>
			<Textarea
				name="description"
				bind:value={$createCategoryForm.description}
				placeholder="Type your message here."
			/>
		</Form.Control>
		<Form.FieldErrors />
	</Form.Field>
	<Button type="submit">Create Category</Button>
</form>
