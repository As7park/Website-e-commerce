<script lang="ts">
	import SEO from '$lib/components/SEO.svelte';

	export let error; // Message d'erreur passé par SvelteKit
</script>

<!-- SEO pour la page d'erreur -->
<SEO pageKey="error" />

<div class="flex items-center justify-center min-h-screen">
	<div class="text-center">
		<h1 class="text-6xl font-bold">404</h1>
		<p class="mt-2 text-lg dark:text-gray-400">
			{error?.message || 'Page not found.'}
		</p>
		<div class="mt-6">
			<a
				href="/"
				class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring focus:ring-blue-300 dark:focus:ring-blue-800"
			>
				Go back home
			</a>
		</div>
	</div>
</div>
