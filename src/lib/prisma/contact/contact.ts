/**
 * Messages de contact.
 *
 * CONTACT-PLUGIN : DAO Prisma du formulaire public et de la lecture admin.
 */
import { prisma } from '$lib/server';
import type { ContactSubmission } from '@prisma/client';
import { normalizeListParams, type ListParams } from '$lib/prisma/pagination';

type CreateContactSubmissionData = Omit<ContactSubmission, 'id' | 'createdAt' | 'updatedAt'>;

const CONTACT_SORTABLE = ['name', 'email', 'subject', 'createdAt'] as const;

export const createContactSubmission = async (data: CreateContactSubmissionData) => {
	try {
		const submission = await prisma.contactSubmission.create({
			data: {
				...data
			}
		});
		return submission;
	} catch (error) {
		console.error('Error creating contact submission:', error);
		throw new Error('Could not create contact submission.');
	}
};

/** Liste paginée pour `/admin/contacts` : recherche sur nom/email/sujet, formulaire public non authentifié donc volume non borné. */
export const getAllContactSubmissions = async (params: ListParams = {}) => {
	const { page, perPage, skip, search, sort, dir } = normalizeListParams(params, {
		perPage: 20,
		defaultSort: 'createdAt',
		sortable: CONTACT_SORTABLE
	});

	const where = search
		? {
				OR: [
					{ name: { contains: search, mode: 'insensitive' as const } },
					{ email: { contains: search, mode: 'insensitive' as const } },
					{ subject: { contains: search, mode: 'insensitive' as const } }
				]
			}
		: undefined;

	try {
		const [items, total] = await Promise.all([
			prisma.contactSubmission.findMany({
				where,
				orderBy: { [sort]: dir },
				skip,
				take: perPage
			}),
			prisma.contactSubmission.count({ where })
		]);
		return { items, total, page, perPage, search, sort, dir };
	} catch (error) {
		console.error('Error retrieving contact submissions:', error);
		throw new Error('Could not retrieve contact submissions.');
	}
};

export const getContactSubmissionById = async (id: string) => {
	try {
		const submission = await prisma.contactSubmission.findUnique({
			where: { id }
		});
		return submission;
	} catch (error) {
		console.error('Error retrieving contact submission:', error);
		throw new Error('Could not retrieve contact submission.');
	}
};
