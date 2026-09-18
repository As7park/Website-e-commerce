import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

// DOMPurify a besoin d'un environnement DOM ; en SSR Node on lui fournit un
// `window` JSDOM minimal. Instance module-level : un seul JSDOM pour tout le
// process, pas un par appel.
const purify = DOMPurify(new JSDOM('').window as unknown as Window & typeof globalThis);

/**
 * Sanitise le HTML riche saisi par un admin (TinyMCE, `BlogPost.content`) en
 * défense en profondeur : neutralise `<script>`, gestionnaires `on*`, `javascript:`,
 * etc., tout en conservant les balises usuelles d'un article (titres, listes,
 * liens, images, tableaux...).
 */
export function sanitizeBlogHtml(html: string): string {
	return purify.sanitize(html, { USE_PROFILES: { html: true } });
}
