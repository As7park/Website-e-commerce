/**
 * AUTH-PLUGIN : autocomplétion du carnet d'adresses.
 * Base Adresse Nationale (api-adresse.data.gouv.fr) — API publique du
 * gouvernement français, sans clé, adresses françaises uniquement. Mock
 * seulement si `SECRET_ADDRESS_SEARCH_MODE` est factice (`e2e`).
 */
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { SECRET_ADDRESS_SEARCH_MODE } from '$env/static/private';
import { E2E_ADDRESS_SUGGESTIONS } from '$lib/addresses/address-search-e2e';
import { isDummySecret } from '$lib/server/dummy-secrets';
import type { AddressSuggestion } from '$lib/addresses/types';

interface BanFeature {
	properties: {
		label: string;
		housenumber?: string;
		name?: string;
		street?: string;
		postcode?: string;
		city?: string;
		context?: string;
	};
}

function normalize(feature: BanFeature): AddressSuggestion {
	const props = feature.properties;
	const [depCode, county, state] = (props.context ?? '').split(', ');
	return {
		formatted: props.label,
		street_number: props.housenumber ?? '',
		street: props.street ?? props.name ?? '',
		city: props.city ?? '',
		zip: props.postcode ?? '',
		county: county ?? '',
		state: state ?? '',
		state_code: depCode ?? '',
		country: 'France',
		country_code: 'FR',
		stateLetter: 'FR',
		ISO_3166_1_alpha_3: 'FRA'
	};
}

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q');
	if (!query) {
		return json({ error: 'Query parameter is missing' }, { status: 400 });
	}

	if (isDummySecret(SECRET_ADDRESS_SEARCH_MODE)) {
		return json({ suggestions: E2E_ADDRESS_SUGGESTIONS });
	}

	const response = await fetch(
		`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`
	);
	if (!response.ok) {
		return json({ error: 'Address search failed' }, { status: 502 });
	}

	const data = await response.json();
	const suggestions = Array.isArray(data.features) ? data.features.map(normalize) : [];

	return json({ suggestions });
};
