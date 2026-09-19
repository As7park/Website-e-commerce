/**
 * Insère une transformation Cloudinary (format + qualité auto, largeur au
 * besoin) dans une URL de livraison déjà stockée en base (`Product.images`),
 * sans ré-upload : Cloudinary sert alors AVIF/WebP selon le navigateur et
 * compresse à la volée au lieu de livrer l'image pleine résolution.
 *
 * Retourne l'URL telle quelle si ce n'est pas une URL Cloudinary `/upload/`
 * (placeholder, donnée de seed, image externe) — jamais d'exception sur une
 * URL inattendue.
 */
const CLOUDINARY_HOST = 'res.cloudinary.com';
const UPLOAD_MARKER = '/upload/';

export function optimizedImageUrl(url: string, width?: number): string {
	if (!url.includes(CLOUDINARY_HOST) || !url.includes(UPLOAD_MARKER)) {
		return url;
	}

	const transformation = width ? `f_auto,q_auto,w_${width}` : 'f_auto,q_auto';
	return url.replace(UPLOAD_MARKER, `${UPLOAD_MARKER}${transformation}/`);
}
