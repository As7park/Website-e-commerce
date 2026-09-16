<script lang="ts">
	import { untrack } from 'svelte';
	import * as Form from '$shadcn/form';
	import { Textarea } from '$shadcn/textarea';
	import { Input } from '$shadcn/input';
	import { Button } from '$shadcn/button';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { createBlogTagSchema } from '$lib/schema/BlogPost/tagSchema';
	import { goto } from '$app/navigation';

	let { data } = $props();

	const createBlogTag = superForm(untrack(() => data?.createTagForm ?? {}), {
		validators: zodClient(createBlogTagSchema),
		id: 'createBlogTag'
	});

	const {
		form: createTagForm,
		enhance: createTagEnhance,
		message: createTagMessage
	} = createBlogTag;

	$effect(() => {
		if ($createTagMessage === 'Tag created successfully') {
			toast.success($createTagMessage), setTimeout(() => goto('/admin/blog/'), 0);
		}
	});
</script>

<h1>Manage Categories</h1>

<form method="POST" action="?/createTag" use:createTagEnhance>
	<Form.Field name="name" form={createBlogTag}>
		<Form.Control>
			<Form.Label>Tag Name</Form.Label>
			<Input name="name" type="text" bind:value={$createTagForm.name} />
		</Form.Control>
		<Form.FieldErrors />
	</Form.Field>
	<Button type="submit">Create Tag</Button>
</form>
