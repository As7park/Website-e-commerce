import { test, expect } from '../support/fixtures';
import { sessionCookie } from '../support/flows';
import { deleteUser, requireUser } from '../support/db';
import { hasLiveGoogleOAuth } from '../support/third-party';

/**
 * Connexion Google : départ réel vers accounts.google.com, déclenché par le
 * client Better Auth (`authClient.signIn.social`, `src/lib/auth/client.ts`)
 * — il n'y a plus de route serveur dédiée (`/auth/login/google`) à
 * interroger directement, Better Auth monte tout sous `/api/auth/**`.
 *
 * Le callback complet ne peut être simulé que si `GOOGLE_CLIENT_ID` est
 * factice (voir `hasLiveGoogleOAuth`) : avec un vrai client, l'échange de
 * code auprès de Google est irréalisable sans y accéder. Dans ce cas, le
 * bypass passe par `auth.api.signInSocial({ idToken })`
 * (`$lib/auth/index.ts`, `verifyIdToken` permissif) : un jeton d'ID JWT
 * syntaxiquement valide mais non signé, que seule cette vérification
 * permissive accepte — jamais en dehors d'un `GOOGLE_CLIENT_ID` factice.
 */

function base64url(value: unknown): string {
	return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/** Jeton d'ID Google syntaxiquement valide, non signé — voir le bypass ci-dessus. */
function fakeGoogleIdToken(claims: { sub: string; email: string; name?: string }): string {
	const header = base64url({ alg: 'none', typ: 'JWT' });
	const payload = base64url({
		iss: 'https://accounts.google.com',
		aud: 'e2e-google-client-id',
		sub: claims.sub,
		email: claims.email,
		email_verified: true,
		name: claims.name ?? 'E2e Google',
		picture: '',
		iat: Math.floor(Date.now() / 1000),
		exp: Math.floor(Date.now() / 1000) + 3600
	});
	return `${header}.${payload}.e2e-unsigned`;
}

test.describe('Auth — Google OAuth', () => {
	test.setTimeout(2 * 60_000);

	test('bouton, départ réel vers Google (et bypass idToken si clés factices)', async ({
		page
	}) => {
		await test.step('1. La page login expose le bouton Google', async () => {
			await page.goto('/auth/login');
			await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
		});

		await test.step('2. Clic : départ vers accounts.google.com', async () => {
			await Promise.all([
				page.waitForURL((url) => url.hostname.endsWith('google.com')),
				page.getByRole('button', { name: 'Sign in with Google' }).click()
			]);
			expect(page.url()).toContain('accounts.google.com');
			expect(page.url()).toContain('client_id=');
		});

		if (hasLiveGoogleOAuth()) {
			// Au-delà, compléter le flux exigerait un vrai accès à Google —
			// non reproductible ici (voir le commentaire de tête).
			return;
		}

		await test.step('3. Bypass idToken (clés factices) : compte créé, connecté', async () => {
			const oauthEmail = `e2e-oauth-${Date.now()}@example.test`;
			try {
				const response = await page.request.post('/api/auth/sign-in/social', {
					data: {
						provider: 'google',
						idToken: {
							token: fakeGoogleIdToken({ sub: `e2e-google-${oauthEmail}`, email: oauthEmail })
						}
					}
				});
				expect(response.ok()).toBe(true);

				expect(await sessionCookie(page)).not.toBeNull();

				const user = await requireUser(oauthEmail);
				expect(user.googleId).toBe(`e2e-google-${oauthEmail}`);
				expect(user.emailVerified).toBe(true);
				expect(user.passwordHash).toBeNull();
			} finally {
				await deleteUser(oauthEmail);
			}
		});
	});
});
