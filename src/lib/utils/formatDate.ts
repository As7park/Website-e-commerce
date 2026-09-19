/**
 * Formate la date selon le pattern "HHh MMmin SSsec DD/MM/YYYY"
 * @param dateString - date au format ISO (e.g. "2025-01-19T21:52:49.864Z")
 * @returns une chaîne de caractère formatée (e.g. "17h 58min 56sec 28/05/2022")
 */
export const formatDate = (dateString: string) => {
	const date = new Date(dateString);

	const hours = date.getHours().toString().padStart(2, '0');
	const minutes = date.getMinutes().toString().padStart(2, '0');
	const seconds = date.getSeconds().toString().padStart(2, '0');

	const day = date.getDate().toString().padStart(2, '0');
	const month = (date.getMonth() + 1).toString().padStart(2, '0');
	const year = date.getFullYear();

	return `${hours}h ${minutes}min ${seconds}sec ${day}/${month}/${year}`;
};
