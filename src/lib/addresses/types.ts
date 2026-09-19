/** Suggestion normalisée, alignée sur les champs de `createAddressSchema`. */
export interface AddressSuggestion {
	formatted: string;
	street_number: string;
	street: string;
	city: string;
	county: string;
	state: string;
	state_code: string;
	zip: string;
	country: string;
	country_code: string;
	stateLetter: string;
	ISO_3166_1_alpha_3: string;
}
