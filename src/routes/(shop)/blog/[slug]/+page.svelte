<script lang="ts">
	import SEO from '$lib/components/SEO.svelte';
	import StructuredData from '$lib/components/StructuredData.svelte';
	import { seoConfig } from '$lib/seo.config';
	import { reveal } from '$lib/actions/reveal';
	import { splatCard } from '$lib/actions/splatCard';

	let { data } = $props();
	let post = $derived(data.post);
	let tags = $derived(post.tags.map((link) => link.tag).filter((tag) => tag.name));
	let relatedPosts = $derived(data.relatedPosts);

	// Pas de champ `excerpt` en base (contenu HTML saisi via TinyMCE) : une
	// description est dérivée du texte brut, tronquée à la longueur usuelle
	// d'un extrait affiché par Google (~155-160 caractères).
	let plainExcerpt = $derived(
		post.content
			.replace(/<[^>]+>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, 160)
	);

	let breadcrumbData = $derived({
		itemListElement: [
			{ '@type': 'ListItem', position: 1, name: 'Accueil', item: seoConfig.site.url },
			{ '@type': 'ListItem', position: 2, name: 'Blog', item: `${seoConfig.site.url}/blog` },
			{
				'@type': 'ListItem',
				position: 3,
				name: post.title,
				item: `${seoConfig.site.url}/blog/${post.slug}`
			}
		]
	});
</script>

<SEO
	type="article"
	title={post.title}
	description={plainExcerpt}
	publishedTime={new Date(post.createdAt).toISOString()}
	modifiedTime={new Date(post.updatedAt).toISOString()}
	author={post.author.name}
	section={post.category?.name}
	tags={tags.map((tag) => tag.name)}
/>
<StructuredData type="BreadcrumbList" data={breadcrumbData} />

<nav class="shop-breadcrumb">
	<a href="/">Accueil</a> / <a href="/blog">Blog</a> / {post.title}
</nav>

<main class="shop-container">
	<article style="padding:24px 0 64px;">
		<div use:reveal style="max-width:68ch;">
			{#if post.category}
				<p class="shop-eyebrow">
					<a href="/blog?categorie={post.category.id}">{post.category.name}</a>
				</p>
			{/if}
			<h1 class="shop-product-title" style="font-size:32px; margin-bottom:12px;">{post.title}</h1>
			<p style="color:var(--shop-text-muted); font-size:13px; margin-bottom:20px;">
				{post.author.name} · {new Date(post.createdAt).toLocaleDateString('fr-FR')} · {data.readingMinutes}
				min de lecture
			</p>

			{#if tags.length}
				<div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:28px;">
					{#each tags as tag (tag.id)}
						<a href="/blog?tag={tag.id}" class="shop-tag">#{tag.name}</a>
					{/each}
				</div>
			{/if}

			<div class="shop-prose">
				<!-- Contenu saisi par un administrateur (TinyMCE). -->
				{@html post.content}
			</div>
		</div>

		{#if relatedPosts.length > 0}
			<section class="shop-section">
				<div class="shop-section-head" use:reveal>
					<h2 class="shop-section-title">À lire aussi</h2>
				</div>
				<div class="shop-grid shop-grid-3">
					{#each relatedPosts as related, i (related.id)}
						<a
							class="shop-card"
							href="/blog/{related.slug}"
							data-wheel-nav
							use:splatCard
							use:reveal={{ delay: i * 60 }}
						>
							<div class="shop-ph shop-ph-landscape">Article</div>
							<p class="shop-card-title">{related.title}</p>
							<p class="shop-card-meta">
								{new Date(related.createdAt).toLocaleDateString('fr-FR')}
							</p>
						</a>
					{/each}
				</div>
			</section>
		{/if}
	</article>
</main>
