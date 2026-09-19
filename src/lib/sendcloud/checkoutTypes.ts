// Formes DTO renvoyées par `/api/sendcloud/shipping-options` (`QuoteDTO` côté
// serveur) et `/api/sendcloud/service-points` (proxy brut Sendcloud v2),
// partagées entre les composants du tunnel de commande
// (`checkout/+page.svelte`, `ShippingOptions.svelte`, `ServicePointMap.svelte`)
// pour éviter de dupliquer/typer en `any` la même forme trois fois.

export type ShippingOptionDTO = {
	id: string;
	carrierCode: string;
	productName: string;
	type: 'service_point' | 'home_delivery';
	price: number;
	eta?: string;
};

export type ServicePointDTO = {
	id: number | string;
	name?: string;
	street?: string;
	postal_code?: string;
	city?: string;
	latitude: number;
	longitude: number;
	shop_type?: string;
	extra_data?: {
		shop_ref?: string;
		ref_cab?: string;
	};
};
