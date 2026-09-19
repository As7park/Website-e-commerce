import { prisma } from '$lib/server';

export const createPasswordResetSessionPrisma = async (session: {
	id: string;
	userId: string;
	email: string;
	code: string;
	expiresAt: Date;
	emailVerified: boolean;
	twoFactorVerified: boolean;
}) => {
	return await prisma.passwordResetSession.create({
		data: {
			id: session.id,
			userId: session.userId,
			email: session.email,
			code: session.code,
			expiresAt: session.expiresAt,
			emailVerified: session.emailVerified,
			twoFactorVerified: session.twoFactorVerified
		}
	});
};

export const findPasswordResetSession = async (sessionId: string) => {
	return await prisma.passwordResetSession.findUnique({
		where: {
			id: sessionId
		},
		include: {
			user: true
		}
	});
};

export const deletePasswordResetSession = async (sessionId: string) => {
	return await prisma.passwordResetSession.delete({
		where: {
			id: sessionId
		}
	});
};

// Marque la session de réinitialisation comme vérifiée par email
export const setPasswordResetSessionAsEmailVerified = async (sessionId: string): Promise<void> => {
	await prisma.passwordResetSession.update({
		where: { id: sessionId },
		data: { emailVerified: true }
	});
};

// Marque la session de réinitialisation comme vérifiée pour 2FA
export const setPasswordResetSessionAs2FAVerified = async (sessionId: string): Promise<void> => {
	await prisma.passwordResetSession.update({
		where: { id: sessionId },
		data: { twoFactorVerified: true }
	});
};

// Invalide toutes les sessions de réinitialisation de mot de passe pour un utilisateur
export const invalidateUserPasswordResetSessions = async (userId: string): Promise<void> => {
	await prisma.passwordResetSession.deleteMany({
		where: { userId }
	});
};
