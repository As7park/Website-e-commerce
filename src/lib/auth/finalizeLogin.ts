/**
 * Dernière étape commune à toute connexion qui vient de produire une vraie
 * session Better Auth (mot de passe direct, 2FA validée, inscription,
 * Google) : géolocalisation de la session, historique, alerte « nouvel
 * appareil ». Jamais appelée quand `signInEmail` renvoie `twoFactorRedirect`
 * (aucune session n'existe encore à ce stade, voir `/auth/login`).
 */
import { prisma } from '#lib/server';
import { getSessionDeviceContext, type SessionDeviceContext } from '#lib/server/deviceContext';
import { recordLoginEvent, type LoginMethod } from '#lib/prisma/loginEvent/loginEvent';
import { notifyNewDeviceLogin } from '#lib/server/newDeviceAlert';

export async function finalizeLogin(
	request: Request,
	params: { userId: string; email: string; token: string | null | undefined; method: LoginMethod }
): Promise<SessionDeviceContext> {
	const device = getSessionDeviceContext(request);

	// `update` (pas `updateMany`) : on a besoin de l'id de ligne de la session
	// (distinct de `token`, le cookie) pour le jeton de révocation « Ce
	// n'était pas moi » ci-dessous.
	const session = params.token
		? await prisma.authSession.update({
				where: { token: params.token },
				data: { city: device.city, country: device.country }
			})
		: null;

	const { isNewDevice } = await recordLoginEvent(params.userId, params.method, device);
	if (isNewDevice && session) {
		void notifyNewDeviceLogin(params.email, params.userId, session.id, device);
	}

	return device;
}
