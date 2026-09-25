import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `anonymizeUser` — droit à l'effacement (RGPD art. 17). Vérifie que le
 * profil est bien scrubé, que les données de préférence sont supprimées,
 * que `Order`/`Transaction`/`Review`/etc. ne sont JAMAIS touchés (aucune
 * suppression de l'historique comptable — le bug que cette fonction
 * remplace), et que les sessions sont invalidées.
 */

const userUpdate = vi.fn().mockResolvedValue({});
const savedPaymentMethodFindMany = vi.fn().mockResolvedValue([]);
const savedPaymentMethodDeleteMany = vi.fn().mockResolvedValue({});
const addressDeleteMany = vi.fn().mockResolvedValue({});
const wishlistItemDeleteMany = vi.fn().mockResolvedValue({});
const stockAlertDeleteMany = vi.fn().mockResolvedValue({});
const productViewDeleteMany = vi.fn().mockResolvedValue({});
const emailVerificationRequestDeleteMany = vi.fn().mockResolvedValue({});
const passwordResetSessionDeleteMany = vi.fn().mockResolvedValue({});
const transactionMock = { updateMany: vi.fn(), deleteMany: vi.fn(), delete: vi.fn() };
const orderMock = { updateMany: vi.fn(), deleteMany: vi.fn(), delete: vi.fn() };
const reviewMock = { updateMany: vi.fn(), deleteMany: vi.fn(), delete: vi.fn() };
const returnRequestMock = { updateMany: vi.fn(), deleteMany: vi.fn(), delete: vi.fn() };
const stripePaymentMethodsDetach = vi.fn().mockResolvedValue({});
const invalidateUserSessions = vi.fn().mockResolvedValue(undefined);

const transactionCalls: unknown[] = [];

vi.mock('$lib/server', () => ({
	prisma: {
		user: { update: userUpdate },
		savedPaymentMethod: {
			findMany: savedPaymentMethodFindMany,
			deleteMany: savedPaymentMethodDeleteMany
		},
		address: { deleteMany: addressDeleteMany },
		wishlistItem: { deleteMany: wishlistItemDeleteMany },
		stockAlert: { deleteMany: stockAlertDeleteMany },
		productView: { deleteMany: productViewDeleteMany },
		emailVerificationRequest: { deleteMany: emailVerificationRequestDeleteMany },
		passwordResetSession: { deleteMany: passwordResetSessionDeleteMany },
		transaction: transactionMock,
		order: orderMock,
		review: reviewMock,
		returnRequest: returnRequestMock,
		$transaction: vi.fn((ops: unknown[]) => {
			transactionCalls.push(...ops);
			return Promise.resolve(ops);
		})
	}
}));

vi.mock('$lib/server/stripe', () => ({
	stripe: { paymentMethods: { detach: stripePaymentMethodsDetach } }
}));

vi.mock('$lib/lucia/session', () => ({ invalidateUserSessions }));

beforeEach(() => {
	vi.clearAllMocks();
	transactionCalls.length = 0;
	savedPaymentMethodFindMany.mockResolvedValue([]);
});

describe('anonymizeUser', () => {
	it('scrube les champs identifiants du profil', async () => {
		const { anonymizeUser } = await import('./anonymizeUser');

		await anonymizeUser('user_1');

		expect(userUpdate).toHaveBeenCalledWith({
			where: { id: 'user_1' },
			data: expect.objectContaining({
				email: 'deleted-user_1@erased.local',
				username: null,
				name: null,
				picture: null,
				passwordHash: null,
				recoveryCode: null,
				totpKey: null,
				googleId: null,
				stripeCustomerId: null,
				isMfaEnabled: false,
				marketingEmailsOptIn: false
			})
		});
	});

	it('supprime les données de préférence (adresses, wishlist, alertes, vues)', async () => {
		const { anonymizeUser } = await import('./anonymizeUser');

		await anonymizeUser('user_1');

		expect(addressDeleteMany).toHaveBeenCalledWith({ where: { userId: 'user_1' } });
		expect(wishlistItemDeleteMany).toHaveBeenCalledWith({ where: { userId: 'user_1' } });
		expect(stockAlertDeleteMany).toHaveBeenCalledWith({ where: { userId: 'user_1' } });
		expect(productViewDeleteMany).toHaveBeenCalledWith({ where: { userId: 'user_1' } });
	});

	it("ne touche jamais l'historique comptable (Order/Transaction/Review/ReturnRequest)", async () => {
		const { anonymizeUser } = await import('./anonymizeUser');

		await anonymizeUser('user_1');

		expect(orderMock.deleteMany).not.toHaveBeenCalled();
		expect(orderMock.updateMany).not.toHaveBeenCalled();
		expect(orderMock.delete).not.toHaveBeenCalled();
		expect(transactionMock.deleteMany).not.toHaveBeenCalled();
		expect(transactionMock.updateMany).not.toHaveBeenCalled();
		expect(transactionMock.delete).not.toHaveBeenCalled();
		expect(reviewMock.deleteMany).not.toHaveBeenCalled();
		expect(returnRequestMock.deleteMany).not.toHaveBeenCalled();
	});

	it('détache chaque moyen de paiement Stripe puis supprime la copie locale', async () => {
		savedPaymentMethodFindMany.mockResolvedValue([
			{ stripePaymentMethodId: 'pm_1' },
			{ stripePaymentMethodId: 'pm_2' }
		]);
		const { anonymizeUser } = await import('./anonymizeUser');

		await anonymizeUser('user_1');

		expect(stripePaymentMethodsDetach).toHaveBeenCalledWith('pm_1');
		expect(stripePaymentMethodsDetach).toHaveBeenCalledWith('pm_2');
		expect(savedPaymentMethodDeleteMany).toHaveBeenCalledWith({ where: { userId: 'user_1' } });
	});

	it('continue même si le détachement Stripe échoue (best-effort)', async () => {
		savedPaymentMethodFindMany.mockResolvedValue([{ stripePaymentMethodId: 'pm_1' }]);
		stripePaymentMethodsDetach.mockRejectedValueOnce(new Error('already detached'));
		const { anonymizeUser } = await import('./anonymizeUser');

		await expect(anonymizeUser('user_1')).resolves.toBeUndefined();
		expect(savedPaymentMethodDeleteMany).toHaveBeenCalled();
	});

	it('invalide toutes les sessions du compte', async () => {
		const { anonymizeUser } = await import('./anonymizeUser');

		await anonymizeUser('user_1');

		expect(invalidateUserSessions).toHaveBeenCalledWith('user_1');
	});
});
