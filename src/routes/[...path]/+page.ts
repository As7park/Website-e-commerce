import { redirect } from '@sveltejs/kit';

// Toute autre URL (anciens liens, /products, /admin…) renvoie vers la page
// d'attente plutôt que vers une 404.
export const prerender = false;

export function load() {
	redirect(307, '/');
}
