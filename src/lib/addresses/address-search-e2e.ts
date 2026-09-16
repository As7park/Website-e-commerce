/**
 * AUTH-PLUGIN : fixture utilisée seulement si `SECRET_ADDRESS_SEARCH_MODE`
 * est factice (`e2e`) — voir `src/routes/api/address-search/+server.ts`.
 */
import type { AddressSuggestion } from './types';

export const E2E_ADDRESS_QUERY = 'Rue des Tests';

/** Requête réelle, assez précise pour obtenir un numéro et Toulouse. */
export const LIVE_ADDRESS_QUERY = '1 Place du Capitole Toulouse';

export const E2E_ADDRESS_SUGGESTIONS: AddressSuggestion[] = [
	{
		formatted: '1 Rue des Tests 31000 Toulouse',
		street_number: '1',
		street: 'Rue des Tests',
		city: 'Toulouse',
		county: 'Haute-Garonne',
		state: 'Occitanie',
		state_code: '31',
		zip: '31000',
		country: 'France',
		country_code: 'FR',
		stateLetter: 'FR',
		ISO_3166_1_alpha_3: 'FRA'
	}
];
