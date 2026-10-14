import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/**
 * Scanne la page courante avec axe-core (règles WCAG 2.0/2.1 A+AA) et fait
 * échouer le test si une violation est détectée. Pensé pour être appelé à un
 * point stable de l'UI (après chargement, avant/après une interaction clé),
 * pas à chaque étape d'un test e2e.
 *
 * `exclude` permet d'ignorer des sélecteurs connus hors de notre contrôle
 * (ex. iframe tierce Stripe) — à documenter en commentaire à chaque usage.
 */
export async function expectNoA11yViolations(page: Page, exclude: string[] = []) {
	let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);

	for (const selector of exclude) {
		builder = builder.exclude(selector);
	}

	const results = await builder.analyze();

	const summary = results.violations.map(
		(violation) =>
			`[${violation.impact}] ${violation.id} — ${violation.help} (${violation.nodes.length} nœud(s))`
	);

	expect(summary, summary.join('\n')).toEqual([]);
}
