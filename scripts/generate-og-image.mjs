#!/usr/bin/env node
/**
 * Génère l'image Open Graph/Twitter par défaut (`static/og-default.jpg`,
 * 1200×630 — taille standard) via Playwright (déjà une dépendance e2e,
 * pas de package supplémentaire). Carte de marque AS7 Park : logo et
 * accroche de la charte (`static/brand/`) sur fond noir.
 *
 * Relancer après tout changement d'identité de marque :
 *   node scripts/generate-og-image.mjs
 */
import { chromium } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(ROOT, 'static', 'og-default.jpg');

const read = (file) => readFile(path.join(ROOT, file), 'utf8');
const WORDMARK_SVG = await read('static/brand/wordmark-white.svg');
const TAGLINE_SVG = await read('static/brand/tagline-white.svg');
const BEBAS_NEUE = (
	await readFile(
		path.join(ROOT, 'node_modules/@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff2')
	)
).toString('base64');

const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<style>
	@font-face {
		font-family: 'Bebas Neue';
		src: url(data:font/woff2;base64,${BEBAS_NEUE}) format('woff2');
	}
	* { margin: 0; padding: 0; box-sizing: border-box; }
	html, body { width: 1200px; height: 630px; }
	body {
		background: #000;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		font-family: 'Bebas Neue', sans-serif;
	}
	.wordmark { width: 680px; }
	.tagline { width: 400px; margin-top: 36px; }
	svg { width: 100%; height: auto; display: block; }
	.rule { width: 90px; height: 4px; background: #ffae00; margin: 32px 0 24px; }
	.designed { font-size: 30px; letter-spacing: 0.34em; color: #fff; }
</style>
</head>
<body>
	<div class="wordmark">${WORDMARK_SVG}</div>
	<div class="tagline">${TAGLINE_SVG}</div>
	<div class="rule"></div>
	<div class="designed">Designed in France</div>
</body>
</html>`;

await mkdir(path.dirname(OUTPUT), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.screenshot({ path: OUTPUT, type: 'jpeg', quality: 92 });
await browser.close();

console.log(`Image générée : ${OUTPUT}`);
