<script lang="ts">
	import { untrack } from 'svelte';
	import * as Form from '$shadcn/form';
	import { Input } from '$shadcn/input';
	import { Button } from '$shadcn/button';
	import { Textarea } from '$shadcn/textarea/index.js';

	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { updateBlogTagSchema } from '$lib/schema/BlogPost/tagSchema';
	import { goto } from '$app/navigation';

	let { data } = $props();

	// Initialiser le formulaire superForm
	const updateBlogTag = superForm(untrack(() => data.updateTagForm), {
		validators: zodClient(updateBlogTagSchema),
		id: 'updateBlogTag'
	});

	// Déstructurer les variables utiles
	const {
		form: updateTagForm,
		enhance: updateTagEnhance,
		message: updateTagMessage
	} = updateBlogTag;

	$effect(() => {
		if ($updateTagMessage === 'Tag updated successfully') {
			toast.success($updateTagMessage);
			setTimeout(() => goto('/admin/blog/'), 1000);
		}
	});
</script>

<h1>Update Tag</h1>

<form method="POST" action="?/updateTag" use:updateTagEnhance class="space-y-4">
	<!-- Champ ID caché pour la mise à jour -->
	<input type="hidden" name="id" value={$updateTagForm.id} />

	<Form.Field name="name" form={updateBlogTag}>
		<Form.Control>
			<Form.Label>Tag Name</Form.Label>
			<Input name="name" type="text" bind:value={$updateTagForm.name} />
		</Form.Control>
		<Form.FieldErrors />
	</Form.Field>
	<Button type="submit">Save Changes</Button>
</form>
