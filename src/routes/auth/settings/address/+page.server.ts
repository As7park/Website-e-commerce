import { deleteAddress, getUserAddresses } from '$lib/prisma/addresses/addresses';
import { deleteAddressSchema } from '$lib/schema/addresses/addressSchema';
import { redirect, type Actions } from '@sveltejs/kit';
import { fail, message, superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

export const load = async (event) => {
	if (!event.locals.session || !event.locals.user) {
		throw redirect(302, '/auth/login');
	}

	const { user } = event.locals;

	// Sous Better Auth, une session n'existe que si la 2FA (quand exigée) a
	// déjà été validée — rien à revérifier ici (voir MIGRATION_BETTER_AUTH.md).

	const address = await getUserAddresses(user.id);
	// console.log(address, 'address');

	const IdeleteAddressSchema = await superValidate(zod(deleteAddressSchema));

	return {
		IdeleteAddressSchema,
		address
	};
};

export const actions: Actions = {
	deleteAddress: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { message: 'Unauthorized' });
		}

		const formData = await request.formData();

		const form = await superValidate(formData, zod(deleteAddressSchema));

		if (!form.valid) return fail(400, { form });

		try {
			const addressId = formData.get('id') as string;
			const result = await deleteAddress(addressId, locals.user.id);
			if (result.count === 0) {
				return fail(403, { form, message: 'Forbidden' });
			}

			return message(form, 'Address deleted successfully');
		} catch (error: unknown) {
			console.error('Error deleting address:', error);
			const errorMessage =
				error instanceof Error ? error.message : 'An error occurred while deleting the address';
			return fail(500, { form, error: errorMessage });
		}
	}
};
