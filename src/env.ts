import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	BETTER_AUTH_SECRET: { static: true },
	GOOGLE_CLIENT_ID: { static: true },
	GOOGLE_CLIENT_SECRET: { static: true },
	PUBLIC_TINYMCE_API_KEY: { public: true, static: true },
	SECRET_ADDRESS_SEARCH_MODE: { static: true }
});
