<script lang="ts">
	import SEO from '$lib/components/SEO.svelte';

	let { data } = $props();

	const PLACEHOLDER = '[À COMPLÉTER]';
	function orPlaceholder(value: string | null): string {
		return value?.trim() ? value : PLACEHOLDER;
	}

	let identityIncomplete = $derived(
		[
			data.company.name,
			data.company.legalForm,
			data.company.shareCapital,
			data.company.address,
			data.company.siret,
			data.company.vatNumber,
			data.company.publicationDirector,
			data.company.email
		].some((value) => !value?.trim())
	);
</script>

<SEO
	title="Mentions légales"
	description="Identification de l'éditeur, de l'hébergeur et du médiateur de la consommation."
/>

<div class="relative box-border min-h-screen w-full px-8 pt-24 pb-16">
	<div class="mx-auto w-full max-w-[760px] space-y-8">
		{#if data.company.logoUrl}
			<img
				src={data.company.logoUrl}
				alt="Logo {data.company.name ?? 'de l’entreprise'}"
				class="h-16 w-auto object-contain"
			/>
		{/if}
		<h1 class="text-2xl font-bold">Mentions légales</h1>

		<section class="space-y-2">
			<h2 class="text-lg font-semibold">Éditeur du site</h2>
			{#if identityIncomplete}
				<p class="text-sm text-muted-foreground">
					⚠️ Informations à compléter avant mise en production — saisissables depuis
					<code>/admin/settings</code>.
				</p>
			{/if}
			<ul class="space-y-1 text-sm">
				<li><strong>Raison sociale :</strong> {orPlaceholder(data.company.name)}</li>
				<li><strong>Forme juridique :</strong> {orPlaceholder(data.company.legalForm)}</li>
				<li><strong>Capital social :</strong> {orPlaceholder(data.company.shareCapital)}</li>
				<li>
					<strong>Adresse du siège social :</strong>
					{orPlaceholder(data.company.address)}{data.company.city ? `, ${data.company.city}` : ''}
				</li>
				<li><strong>SIRET :</strong> {orPlaceholder(data.company.siret)}</li>
				<li>
					<strong>Numéro de TVA intracommunautaire :</strong>
					{orPlaceholder(data.company.vatNumber)}
				</li>
				<li>
					<strong>Directeur de la publication :</strong>
					{orPlaceholder(data.company.publicationDirector)}
				</li>
				<li><strong>E-mail de contact :</strong> {orPlaceholder(data.company.email)}</li>
			</ul>
		</section>

		<section class="space-y-2">
			<h2 class="text-lg font-semibold">Hébergement</h2>
			<p class="text-sm">
				Ce site est hébergé par :<br />
				<strong>Vercel Inc.</strong><br />
				440 N Barranca Ave #4133, Covina, CA 91723, États-Unis<br />
				<a href="https://vercel.com" target="_blank" rel="noopener noreferrer" class="underline"
					>vercel.com</a
				>
			</p>
		</section>

		<section class="space-y-2">
			<h2 class="text-lg font-semibold">Médiation de la consommation</h2>
			<p class="text-sm">
				Conformément aux articles L616-1 et R616-1 du Code de la consommation, tout consommateur a
				le droit de recourir gratuitement à un médiateur de la consommation en vue de la résolution
				amiable d'un litige. Le médiateur retenu pour ce site est :
			</p>
			<p class="text-sm text-muted-foreground">
				⚠️ Médiateur à désigner et à contractualiser — deux médiateurs généralistes agréés,
				fréquemment utilisés par les e-commerçants français, pour référence :
			</p>
			<ul class="list-disc space-y-1 pl-5 text-sm">
				<li>
					CNPM – Médiation de la consommation — <a
						href="https://cnpm-mediation-consommation.eu"
						target="_blank"
						rel="noopener noreferrer"
						class="underline">cnpm-mediation-consommation.eu</a
					>
				</li>
				<li>
					Médiée — <a
						href="https://mediee.fr"
						target="_blank"
						rel="noopener noreferrer"
						class="underline">mediee.fr</a
					>
				</li>
			</ul>
			<p class="text-sm">
				La plateforme européenne de règlement en ligne des litiges (RLL) est également accessible à
				l'adresse
				<a
					href="https://ec.europa.eu/consumers/odr"
					target="_blank"
					rel="noopener noreferrer"
					class="underline">ec.europa.eu/consumers/odr</a
				>.
			</p>
		</section>

		<section class="space-y-2">
			<h2 class="text-lg font-semibold">Propriété intellectuelle</h2>
			<p class="text-sm">
				L'ensemble des contenus de ce site (textes, images, logos, mise en page) est protégé par le
				droit d'auteur. Toute reproduction, même partielle, sans autorisation préalable est
				interdite.
			</p>
		</section>

		<p class="text-xs text-muted-foreground">
			Voir aussi les <a href="/cgv" class="underline">conditions générales de vente</a> et la
			<a href="/confidentialite" class="underline">politique de confidentialité</a>.
		</p>
	</div>
</div>
