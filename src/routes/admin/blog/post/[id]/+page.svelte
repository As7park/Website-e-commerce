<script lang="ts">
	import { untrack } from 'svelte';
	// ----- Imports -----
	import * as Form from '$shadcn/form';
	import * as Popover from '$shadcn/popover';
	import * as Command from '$shadcn/command';
	import { Input } from '$shadcn/input';
	import { Button } from '$shadcn/button';
	import { Checkbox } from '$shadcn/checkbox';
	import { Label } from '$shadcn/label';
	import Editor from '@tinymce/tinymce-svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';

	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { updateBlogPostSchema } from '$lib/schema/BlogPost/BlogPostSchema.js';
	import { PUBLIC_TINYMCE_API_KEY } from '$env/static/public';

	// ----- Props from the server -----
	let { data } = $props();

	// ----- Prepare superForm for update -----
	const updateForm = superForm(
		untrack(() => data.IupdateBlogPostSchema),
		{
			validators: zodClient(updateBlogPostSchema)
		}
	);

	const {
		form: updateData, // The reactive form data
		enhance: updateEnhance,
		message: updateMessage
	} = updateForm;

	// On success, show toast and redirect
	$effect(() => {
		if ($updateMessage === 'Post updated successfully') {
			toast.success($updateMessage);
			setTimeout(() => goto('/admin/blog'), 0);
		}
	});

	// ----- Categories -----
	let categories = $state(untrack(() => data.AllCategoriesPost || []));
	let selectedCategoryName = $state('');

	$effect(() => {
		if ($updateData.categoryId && categories.length) {
			const found = categories.find((cat) => cat.id === $updateData.categoryId);
			if (found) selectedCategoryName = found.name;
		}
	});

	// ----- Tags -----
	let allTags = $state(untrack(() => data.AllTagsPost || []));

	/**
	 * Initialize local `tags` array with a `checked` property
	 * based on the relation. For example, if the post is linked to the tag,
	 * set checked = true.
	 */
	let tags = $state(
		allTags.map((tag) => {
			// On vérifie si l'ID du post figure dans la relation many-to-many du tag
			const isLinked = tag.posts.some((rel) => rel.postId === $updateData.id);
			return {
				...tag,
				checked: isLinked
			};
		})
	);

	/**
	 * New variable that holds only the IDs of the checked tags.
	 * This is separate from $updateData.tagIds, so you can use it
	 * for display or other logic as needed.
	 */
	let checkedTagIds = $state<string[]>([]);

	/**
	 * Whenever `tags` changes, we update:
	 * - $updateData.tagIds: needed for the form submission
	 * - checkedTagIds: a new array containing only the checked tag IDs
	 */
	$effect(() => {
		const newCheckedIds = tags
			.filter((t) => t.checked)
			.map((t) => t.id)
			.filter(Boolean);

		// Update the superform data
		$updateData.tagIds = newCheckedIds;

		// Also update our separate local variable
		checkedTagIds = newCheckedIds;
	});

	// ----- TinyMCE config -----
	let editorConfig = {
		telemetry: false,
		branding: false,
		license_key: 'gpl',
		plugins: [
			'advlist autolink lists link image charmap anchor searchreplace visualblocks code fullscreen insertdatetime media table preview help wordcount'
		],
		toolbar:
			'undo redo | blocks | bold italic forecolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat | help'
	};

	let openCategory = $state(false);
	let openTag = $state(false);

	function handleSelectCategory(cat: { id: string; name: string }) {
		selectedCategoryName = cat.name;
		$updateData.categoryId = cat.id;
		openCategory = false;
	}

	// $effect(() => {
	// 	console.log(JSON.stringify($updateData, null, 2), JSON.stringify(checkedTagIds, null, 2));
	// });
</script>

<form method="POST" action="?/updatePost" use:updateEnhance class="space-y-4">
	<!-- Title -->
	<Form.Field name="title" form={updateForm}>
		<Form.Control>
			<Form.Label>Title</Form.Label>
			<Input name="title" type="text" bind:value={$updateData.title} />
		</Form.Control>
		<Form.FieldErrors />
	</Form.Field>

	<!-- Published -->
	<Form.Field name="published" form={updateForm}>
		<Form.Control>
			<div class="flex items-center">
				<Checkbox name="published" bind:checked={$updateData.published as boolean} />
				<Label class="ml-2">Published</Label>
			</div>
		</Form.Control>
		<Form.FieldErrors />
	</Form.Field>

	<!-- Category Popover -->
	<div class="flex items-center space-x-4">
		<Popover.Root bind:open={openCategory}>
			<Popover.Trigger>
				<Button>Category: {selectedCategoryName}</Button>
			</Popover.Trigger>
			<Popover.Content class="p-4">
				<Command.Root>
					{#each categories as cat}
						<Command.Item onSelect={() => handleSelectCategory(cat)}>
							{cat.name}
						</Command.Item>
					{/each}
				</Command.Root>
			</Popover.Content>
		</Popover.Root>

		<!-- Tags Popover -->
		<Popover.Root bind:open={openTag}>
			<Popover.Trigger>
				<Button>Tags: {$updateData.tagIds?.length ?? 0} selected</Button>
			</Popover.Trigger>
			<Popover.Content class="p-4 space-y-2">
				{#each tags as tag, i}
					<div class="flex items-center space-x-2">
						<input
							type="checkbox"
							id={'tag-' + tag.id}
							checked={tag.checked}
							onchange={(e) => {
								// Immutable update to force Svelte to register changes
								tags[i] = { ...tag, checked: (e.target as HTMLInputElement).checked };
							}}
						/>
						<Label for={'tag-' + tag.id}>{tag.name}</Label>
					</div>
				{/each}
			</Popover.Content>
		</Popover.Root>
	</div>

	<!-- Content -->
	<Form.Field name="content" form={updateForm}>
		<Form.Control>
			<Form.Label>Content</Form.Label>
			<Editor
				conf={editorConfig}
				scriptSrc="/tinymce/tinymce.min.js"
				apiKey={PUBLIC_TINYMCE_API_KEY}
				bind:value={$updateData.content}
			/>
		</Form.Control>
		<Form.FieldErrors />
	</Form.Field>

	<!-- Hidden fields for the form submission -->
	<input type="hidden" name="id" value={$updateData.id} />
	<input type="hidden" name="authorId" bind:value={$updateData.authorId} />
	<input type="hidden" name="categoryId" bind:value={$updateData.categoryId} />
	<input type="hidden" name="content" bind:value={$updateData.content} />
	<input type="hidden" name="tagIds" bind:value={$updateData.tagIds} />

	<!-- Submit -->
	<Button type="submit">Save changes</Button>
</form>
