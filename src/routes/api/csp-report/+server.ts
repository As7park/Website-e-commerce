/**
 * Collecte des violations CSP (`svelte.config.js` → `kit.csp.reportOnly`,
 * directive `report-uri`). Le navigateur poste ici en `application/csp-report`
 * ou `application/reports+json` selon le format ; on se contente de logger,
 * le temps de calibrer la politique avant de la rendre bloquante.
 */
export async function POST({ request }) {
	try {
		const body = await request.json();
		console.warn('[CSP Report-Only] violation :', JSON.stringify(body));
	} catch (error) {
		console.warn('[CSP Report-Only] rapport illisible :', error);
	}
	// 204 : pas de corps, cf. RFC 9110.
	return new Response(null, { status: 204 });
}
