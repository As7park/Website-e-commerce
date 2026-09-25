<script lang="ts">
	const legalLinks = [
		{ href: '/mentions-legales', label: 'Mentions légales' },
		{ href: '/cgv', label: 'CGV' },
		{ href: '/confidentialite', label: 'Confidentialité' },
		{ href: '/contact', label: 'Contact' }
	];

	const year = new Date().getFullYear();
</script>

<footer class="border-t border-border/60 px-8 py-6 text-sm text-muted-foreground">
	<div class="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 sm:flex-row">
		<p>© {year} MadeInDiamonds</p>
		<nav class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
			{#each legalLinks as link (link.href)}
				<a href={link.href} class="underline-offset-4 hover:underline">{link.label}</a>
			{/each}
		</nav>
	</div>
</footer>
