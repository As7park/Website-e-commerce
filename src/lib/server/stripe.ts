import Stripe from 'stripe';
import { env } from '$env/dynamic/private';

let client: Stripe | undefined;

/**
 * Client créé à la première utilisation : `$env/dynamic/private` est vide
 * pendant l'analyse du build SvelteKit, qui importe ce module, et `new Stripe`
 * lève une erreur sans clé. Les consommateurs gardent `stripe.xxx` tel quel.
 */
export const stripe = new Proxy({} as Stripe, {
	get(_target, property) {
		client ??= new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-08-27.basil' });
		const value = Reflect.get(client, property);
		return typeof value === 'function' ? value.bind(client) : value;
	}
});
