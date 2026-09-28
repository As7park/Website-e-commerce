#!/usr/bin/env node
/**
 * Génère l'image Open Graph/Twitter par défaut (`static/og-default.jpg`,
 * 1200×630 — taille standard) via Playwright (déjà une dépendance e2e,
 * pas de package supplémentaire). Carte de marque AS7 Park : logo
 * (`static/logo.svg`), nom et accroche aux couleurs de la boutique.
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

const LOGO_SVG = await readFile(path.join(ROOT, 'static', 'logo.svg'), 'utf8');

const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
	href="https://fonts.googleapis.com/css2?family=Staatliches&family=Space+Grotesk:wght@500&display=swap"
	rel="stylesheet"
/>
<style>
	* { margin: 0; padding: 0; box-sizing: border-box; }
	html, body { width: 1200px; height: 630px; }
	body {
		background: radial-gradient(circle at 30% 20%, #1d1a15 0%, #14120f 65%);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		font-family: 'Space Grotesk', sans-serif;
	}
	.logo { width: 150px; height: 150px; margin-bottom: 32px; }
	.logo svg { width: 100%; height: 100%; display: block; }
	.wordmark {
		font-family: 'Staatliches', sans-serif;
		font-size: 104px;
		line-height: 1;
		letter-spacing: 0.04em;
		color: #f2efe4;
	}
	.rule {
		width: 90px;
		height: 3px;
		background: #ffb200;
		margin: 24px 0;
	}
	.tagline {
		font-weight: 500;
		font-size: 28px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #ffb200;
	}
</style>
</head>
<body>
	<div class="logo">${LOGO_SVG}</div>
	<div class="wordmark">AS7 Park</div>
	<div class="rule"></div>
	<div class="tagline">Équipement &amp; pièces moto</div>
</body>
</html>`;

await mkdir(path.dirname(OUTPUT), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.screenshot({ path: OUTPUT, type: 'jpeg', quality: 92 });
await browser.close();

console.log(`Image générée : ${OUTPUT}`);
