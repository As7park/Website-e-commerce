import { describe, it, expect } from 'vitest';
import { sanitizeBlogHtml } from './sanitizeHtml';

describe('sanitizeBlogHtml', () => {
	it('strips <script> tags', () => {
		const result = sanitizeBlogHtml('<p>Hello</p><script>alert(1)</script>');
		expect(result).not.toContain('<script');
		expect(result).toContain('<p>Hello</p>');
	});

	it('strips inline event handler attributes', () => {
		const result = sanitizeBlogHtml('<img src="x.png" onerror="alert(1)">');
		expect(result).not.toContain('onerror');
	});

	it('strips javascript: URLs', () => {
		const result = sanitizeBlogHtml('<a href="javascript:alert(1)">click</a>');
		expect(result).not.toContain('javascript:');
	});

	it('keeps legitimate rich-text markup intact', () => {
		const html =
			'<h2>Titre</h2><p>Un <strong>article</strong> avec une <a href="/blog">liste</a>.</p>' +
			'<ul><li>Un</li><li>Deux</li></ul><img src="https://example.test/x.png" alt="illustration">';
		const result = sanitizeBlogHtml(html);
		expect(result).toContain('<h2>Titre</h2>');
		expect(result).toContain('<strong>article</strong>');
		expect(result).toContain('href="/blog"');
		expect(result).toContain('<li>Un</li>');
		expect(result).toContain('src="https://example.test/x.png"');
	});
});
