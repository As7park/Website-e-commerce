<script lang="ts">
	import Table from '$components/Table.svelte';
	import type { TableAction, TableColumn } from '$components/Table.svelte';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import Pencil from 'lucide-svelte/icons/pencil';
	import Trash from 'lucide-svelte/icons/trash';
	import { deleteBlogPostSchema } from '$lib/schema/BlogPost/BlogPostSchema.js';
	import { deleteBlogCategorySchema } from '$lib/schema/BlogPost/categoriesSchema.js';
	import { deleteBlogTagSchema } from '$lib/schema/BlogPost/tagSchema.js';

	// Props
	let { data } = $props();

	//console.log(data, 'data');

	// Form handling with superForm
	const deleteBlogPost = superForm(data?.IdeleteBlogPostSchema ?? {}, {
		validators: zodClient(deleteBlogPostSchema),
		id: 'deleteBlogPost'
	});

	const deleteBlogCategory = superForm(data?.IdeleteBlogCategorySchema ?? {}, {
		validators: zodClient(deleteBlogCategorySchema),
		id: 'deleteBlogCategory'
	});

	const deleteBlogTag = superForm(data?.IdeleteBlogTagSchema ?? {}, {
		validators: zodClient(deleteBlogTagSchema),
		id: 'deleteBlogTag'
	});

	const {
		form: deleteBlogPostData,
		enhance: deleteBlogPostEnhance,
		message: deleteBlogPostMessage
	} = deleteBlogPost;

	const {
		form: deleteBlogCategoryData,
		enhance: deleteBlogCategoryEnhance,
		message: deleteBlogCategoryMessage
	} = deleteBlogCategory;

	const {
		form: deleteBlogTagData,
		enhance: deleteBlogTagEnhance,
		message: deleteBlogTagMessage
	} = deleteBlogTag;

	/**
	 * categoryMap: a Map that associates categoryId -> categoryName
	 */
	const categoryMap = $derived.by(() => {
		const map = new Map();
		(data.AllCategoriesPost ?? []).forEach((cat) => {
			map.set(cat.id, cat.name);
		});
		return map;
	});

	/**
	 * formattedBlogPosts: an array of blog posts
	 * with additional fields `category` and `tagsString` for display
	 */
	const formattedBlogPosts = $derived.by(() => {
		return (data.BlogPost ?? []).map((post) => {
			const categoryName = categoryMap.get(post.categoryId) ?? 'Non classé';
			const tagNames = (post.tags ?? [])
				.map((rel) => rel.tag?.name ?? '')
				.filter(Boolean)
				.join(', ');

			return {
				...post,
				category: categoryName,
				tagsString: tagNames
			};
		});
	});

	// Define table columns
	const PostsColumns = $state<TableColumn[]>([
		{ key: 'title', label: 'Title' },
		{ key: 'category', label: 'Category' },
		{ key: 'tagsString', label: 'Tags' },
		{ key: 'published', label: 'Published' }
	]);

	const CategoriesColumns = $state<TableColumn[]>([
		{ key: 'name', label: 'Name' },
		{ key: 'description', label: 'Description' }
	]);

	const TagsColumns = $state<TableColumn[]>([{ key: 'name', label: 'Name' }]);

	// Define actions with icons
	const PostsActions = $state<TableAction[]>([
		{
			type: 'link',
			name: 'edit',
			url: (item) => `/admin/blog/post/${item.id}`,
			icon: Pencil
		},
		{
			type: 'form',
			name: 'delete',
			url: '?/deleteBlogPost',
			enhanceAction: deleteBlogPostEnhance,
			icon: Trash
		}
	]);

	const CategoriesActions = $state<TableAction[]>([
		{
			type: 'link',
			name: 'edit',
			url: (item) => `/admin/blog/categories/${item.id}`,
			icon: Pencil
		},
		{
			type: 'form',
			name: 'delete',
			url: '?/deleteBlogCategory',
			enhanceAction: deleteBlogCategoryEnhance,
			icon: Trash
		}
	]);

	const TagsActions = $state<TableAction[]>([
		{
			type: 'link',
			name: 'edit',
			url: (item) => `/admin/blog/tags/${item.id}`,
			icon: Pencil
		},
		{
			type: 'form',
			name: 'delete',
			url: '?/deleteBlogTag',
			enhanceAction: deleteBlogTagEnhance,
			icon: Trash
		}
	]);

	// Show toast on delete message
	$effect(() => {
		if ($deleteBlogPostMessage) {
			toast.success($deleteBlogPostMessage);
		}
		if ($deleteBlogCategoryMessage) {
			toast.success($deleteBlogCategoryMessage);
		}
		if ($deleteBlogTagMessage) {
			toast.success($deleteBlogTagMessage);
		}
	});
</script>

<h1 class="m-5 text-4xl">Gestion du blog</h1>

<!-- UI Table -->
<div class="ccc w-[100%]">
	<Table
		name="Articles"
		columns={PostsColumns}
		data={formattedBlogPosts}
		actions={PostsActions}
		addLink="/admin/blog/post/create"
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
		name="Catégories"
		columns={CategoriesColumns}
		data={data.AllCategoriesPost ?? []}
		actions={CategoriesActions}
		addLink="/admin/blog/categories/create"
	/>
</div>

<div class="ccc w-[100%]">
	<Table
		name="Tags"
		columns={TagsColumns}
		data={data.AllTagsPost ?? []}
		actions={TagsActions}
		addLink="/admin/blog/tags/create"
	/>
</div>
