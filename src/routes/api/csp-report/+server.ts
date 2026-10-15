/**
 * Collecte des violations CSP (`svelte.config.js` → `kit.csp.directives`,
 * directive `report-uri`). Le navigateur poste ici en `application/csp-report`
 * ou `application/reports+json` selon le format. La politique est bloquante :
 * ces logs signalent une directive manquante (le navigateur a déjà bloqué la
 * ressource), ce n'est plus une simple calibration avant activation.
 */
export async function POST({ request }) {
	try {
		const body = await request.json();
		console.warn('[CSP] violation :', JSON.stringify(body));
	} catch (error) {
		console.warn('[CSP] rapport illisible :', error);
	}
	// 204 : pas de corps, cf. RFC 9110.
	return new Response(null, { status: 204 });
}
