<script lang="ts">
	// Importation des composants principaux
	import * as Sidebar from '$shadcn/sidebar/index.js';
	import SmoothScrollBar from '$lib/components/smoothScrollBar/SmoothScrollBar.svelte';

	let { data, children } = $props();

	// Données de navigation — les entrées liées à un module optionnel ne
	// sont incluses que si `StoreSettings.<flag>` est actif (voir
	// `+layout.server.ts`), sinon un admin verrait un lien vers un module
	// désactivé côté client.
	const navMain = $derived([
		{
			title: 'Dashboard',
			items: [
				{ title: 'Accueil', url: '/admin' },
				{ title: 'ventes', url: '/admin/sales' }, // COMMERCE-PLUGIN
				{ title: 'utilisateurs', url: '/admin/users' },
				{ title: 'produits', url: '/admin/products' }, // PRODUCT-PLUGIN
				{ title: 'avis', url: '/admin/products/reviews' }, // PRODUCT-PLUGIN
				...(data.productQnaEnabled
					? [{ title: 'questions produits', url: '/admin/products/questions' }] // PRODUCT-PLUGIN
					: []),
				{ title: 'blog', url: '/admin/blog' }, // BLOG-PLUGIN
				{ title: 'promo', url: '/admin/promo' }, // PROMO-PLUGIN
				...(data.giftCardsEnabled ? [{ title: 'cartes cadeaux', url: '/admin/gift-cards' }] : []),
				...(data.returnsEnabled
					? [{ title: 'retours', url: '/admin/returns' }] // COMMERCE-PLUGIN
					: []),
				...(data.fraudDetectionEnabled
					? [{ title: 'fraude', url: '/admin/fraud' }] // COMMERCE-PLUGIN
					: []),
				{ title: 'contacts', url: '/admin/contacts' }, // CONTACT-PLUGIN
				{ title: 'métriques', url: '/admin/metrics' },
				{ title: 'exports', url: '/admin/exports' },
				{ title: 'identité de l’entreprise', url: '/admin/identite' },
				{ title: 'modules', url: '/admin/settings' }
			]
		}
	]);
</script>

<div class="w-screen h-screen">
	<Sidebar.Provider>
		<Sidebar.Root class="border-none">
			<!-- Contenu de la Sidebar -->
			<Sidebar.Content>
				{#each navMain as group (group.title)}
					<Sidebar.Group>
						<Sidebar.GroupLabel>{group.title}</Sidebar.GroupLabel>
						<Sidebar.Menu>
							{#each group.items as item (item.url)}
								<Sidebar.MenuItem>
									<Sidebar.MenuButton>
										<a href={item.url}>{item.title}</a>
									</Sidebar.MenuButton>
								</Sidebar.MenuItem>
							{/each}
						</Sidebar.Menu>
					</Sidebar.Group>
				{/each}
			</Sidebar.Content>
		</Sidebar.Root>

		<!-- Contenu principal -->
		<Sidebar.Inset class="border rounded-[12px] m-3 max-h-[95vh] min-h-[95vh]">
			<SmoothScrollBar>
				<header class="absolute flex items-center gap-2 px-4 h-16">
					<Sidebar.Trigger />
				</header>

				<div class="py-[40px]">
					{@render children?.()}
				</div>
			</SmoothScrollBar>
		</Sidebar.Inset>
	</Sidebar.Provider>
</div>
