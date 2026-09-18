import prettier from 'eslint-config-prettier';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

export default ts.config(
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs['flat/recommended'],
	prettier,
	...svelte.configs['flat/prettier'],
	{
		rules: {
			// Convention déjà utilisée dans le repo pour les paramètres
			// intentionnellement inutilisés (ex: signature imposée par un type).
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
		}
	},
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		}
	},
	{
		// *.svelte.ts/js (fichiers "universal reactivity" Svelte 5) sont aussi
		// parsés par svelte-eslint-parser et ont besoin du parser TS, sinon la
		// syntaxe TS moderne (ex: `import { type X }`) casse le parsing.
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],

		languageOptions: {
			parserOptions: {
				parser: ts.parser
			}
		}
	},
	{
		// k6 injecte ces globales au runtime (scripts exécutés hors Node/browser).
		files: ['k6/**'],
		languageOptions: {
			globals: {
				__ENV: 'readonly',
				__VU: 'readonly',
				__ITER: 'readonly'
			}
		}
	},
	{
		// static/tinymce est une librairie vendorisée/minifiée : la lint génère
		// des milliers de faux positifs sans rapport avec le code applicatif.
		ignores: ['build/', '.svelte-kit/', 'dist/', 'static/tinymce/']
	}
);
