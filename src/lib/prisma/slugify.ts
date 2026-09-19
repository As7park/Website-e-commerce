// utils/slugify.ts
export function slugify(text: string): string {
	return text
		.toString()
		.toLowerCase()
		.replace(/\s+/g, '-') // Remplacer les espaces par des tirets
		.replace(/[^\w-]+/g, '') // Retirer tous les caractères non-alphanumériques et les tirets
		.replace(/--+/g, '-') // Remplacer les multiples tirets par un seul
		.replace(/^-+/, '') // Retirer les tirets de début
		.replace(/-+$/, ''); // Retirer les tirets de fin
}
