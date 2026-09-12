import { zod } from 'sveltekit-superforms/adapters';
import type { PageServerLoad, Actions } from './$types';
import { message, superValidate } from 'sveltekit-superforms';
import { deleteUserSchema } from '$lib/schema/users/userSchema';
import { deleteUser, getAllUsers } from '$lib/prisma/user/user';
import { serializeData } from '$lib/utils/serializeData';
import { assertAdmin, requireAdmin } from '$lib/admin/guards';

/**
 * Liste des comptes et suppression.
 *
 * Les secrets (hash, TOTP, code de secours) sont exclus dès la requête Prisma :
 * ils ne doivent jamais transiter vers le navigateur, même pour un admin.
 */

export const load: PageServerLoad = async ({ locals, url }) => {
	assertAdmin(locals);

	const IdeleteUserSchema = await superValidate(zod(deleteUserSchema));

	const { items, total, page, perPage, search, sort, dir } = await getAllUsers({
		page: Number(url.searchParams.get('page')) || undefined,
		perPage: Number(url.searchParams.get('perPage')) || undefined,
		search: url.searchParams.get('q') ?? undefined,
		sort: url.searchParams.get('sort') ?? undefined,
		dir: url.searchParams.get('dir') === 'desc' ? 'desc' : undefined
	});

	const allUsers = serializeData(items);

	return {
		IdeleteUserSchema,
		allUsers,
		total,
		page,
		perPage,
		search,
		sort,
		dir
	};
};

// Action pour supprimer un utilisateur
export const actions: Actions = {
	deleteUser: async ({ request, locals }) => {
		requireAdmin(locals);

		const formData = await request.formData();
		// console.log('Received form data:', formData);

		const id = formData.get('id') as string;

		const form = await superValidate(formData, zod(deleteUserSchema));

		try {
			await deleteUser(id);

			return message(form, 'User deleted successfully');
		} catch (error) {
			console.error('Error deleting user:', error);
			return { error: 'Failed to delete user' };
		}
	}
};
