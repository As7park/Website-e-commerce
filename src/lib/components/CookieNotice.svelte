<script lang="ts">
	import { Button } from '$shadcn/button';

	/**
	 * Bannière d'information cookies — pas un gestionnaire de consentement :
	 * aucun traceur non essentiel (analytics, pixel marketing) n'existe dans
	 * ce projet aujourd'hui, seuls des cookies de session strictement
	 * nécessaires (auth, panier). Si des traceurs sont ajoutés plus tard,
	 * ce composant devra devenir un vrai bandeau de consentement
	 * (accepter/refuser par finalité) avant leur activation.
	 */
	const STORAGE_KEY = 'cookie-notice-seen';

	function readSeen(): boolean {
		if (typeof window === 'undefined') return true;
		try {
			return window.localStorage.getItem(STORAGE_KEY) === '1';
		} catch {
			return true;
		}
	}

	// Pas de valeur réactive à suivre (`readSeen()` ne dépend d'aucun état du
	// composant) : un simple initialiseur suffit, réévalué naturellement au
	// montage client (le rendu SSR, sans `window`, part de « non vue »).
	let visible = $state(!readSeen());

	function dismiss() {
		visible = false;
		if (typeof window === 'undefined') return;
		try {
			window.localStorage.setItem(STORAGE_KEY, '1');
		} catch {
			// Stockage indisponible (navigation privée, quota) — la bannière
			// réapparaîtra à la prochaine visite, pas bloquant.
		}
	}
</script>

{#if visible}
	<div
		class="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-xl flex-col gap-3 rounded-lg border bg-background p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between"
	>
		<p class="text-sm text-muted-foreground">
			Ce site utilise uniquement des cookies de session nécessaires à son fonctionnement (connexion,
			panier) — aucun cookie publicitaire ni traceur de mesure d'audience. En savoir plus dans notre
			<a href="/confidentialite" class="underline">politique de confidentialité</a>.
		</p>
		<Button size="sm" onclick={dismiss} class="shrink-0">Compris</Button>
	</div>
{/if}
