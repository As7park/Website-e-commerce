<script lang="ts">
	interface StructuredDataProps {
		type: 'Organization' | 'WebSite' | 'Article' | 'Product' | 'BreadcrumbList';
		data: Record<string, any>;
	}

	let { type, data }: StructuredDataProps = $props();

	// Construire l'objet de données structurées
	const structuredData = $derived({
		'@context': 'https://schema.org',
		'@type': type,
		...data
	});
</script>

<svelte:head>
	<script type="application/ld+json">
		{JSON.stringify(structuredData)}
	</script>
</svelte:head>
