import { prisma } from '$lib/server';

// Fonction pour vérifier la disponibilité de l'email dans la base de données
export async function checkEmailAvailability(email: string): Promise<boolean> {
	const user = await prisma.user.findUnique({
		where: { email },
		select: { id: true }
	});

	// Si aucun utilisateur n'est trouvé, l'email est disponible
	return user === null;
}
