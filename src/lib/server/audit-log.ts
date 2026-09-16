import { Prisma } from '@prisma/client';
import { prisma } from '$lib/server';
import { log } from '$lib/server/log';

/**
 * Journalise une action admin sensible (suppression de compte, changement de
 * rôle...). Best-effort : une panne du journal ne doit jamais bloquer l'action
 * elle-même, seulement être visible dans les logs applicatifs.
 */
export async function logAdminAction(params: {
	actorId: string;
	action: string;
	targetType: string;
	targetId: string;
	metadata?: Record<string, unknown>;
}): Promise<void> {
	try {
		await prisma.adminAuditLog.create({
			data: {
				actorId: params.actorId,
				action: params.action,
				targetType: params.targetType,
				targetId: params.targetId,
				metadata: params.metadata as Prisma.InputJsonValue | undefined
			}
		});
	} catch (error) {
		log('ERROR', 'admin-audit-log', "Échec de l'écriture du journal d'audit", {
			...params,
			error
		});
	}
}
