// Copie les assets TinyMCE self-hosted (node_modules/tinymce) vers static/tinymce,
// servis par Vite en dev/prod à l'URL /tinymce (voir scriptSrc dans les pages admin/blog).
import { cpSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(root, 'node_modules', 'tinymce');
const dest = path.join(root, 'static', 'tinymce');

if (!existsSync(src)) {
	console.error('node_modules/tinymce introuvable — `npm install` a-t-il échoué ?');
	process.exit(1);
}

cpSync(src, dest, { recursive: true });
console.log(`TinyMCE copié : ${src} -> ${dest}`);
