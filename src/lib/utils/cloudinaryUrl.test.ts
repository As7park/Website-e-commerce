import { describe, it, expect } from 'vitest';
import { optimizedImageUrl } from './cloudinaryUrl';

const CLOUDINARY_URL = 'https://res.cloudinary.com/demo/image/upload/v1/products/foo.jpg';

describe('optimizedImageUrl', () => {
	it('injects f_auto,q_auto for a Cloudinary /upload/ URL', () => {
		expect(optimizedImageUrl(CLOUDINARY_URL)).toBe(
			'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/products/foo.jpg'
		);
	});

	it('adds a width transformation when provided', () => {
		expect(optimizedImageUrl(CLOUDINARY_URL, 400)).toBe(
			'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_400/v1/products/foo.jpg'
		);
	});

	it('returns non-Cloudinary URLs unchanged', () => {
		const external = 'https://example.com/image.jpg';
		expect(optimizedImageUrl(external)).toBe(external);
	});

	it('returns Cloudinary URLs without /upload/ unchanged', () => {
		const noUpload = 'https://res.cloudinary.com/demo/raw/authenticated/v1/file.csv';
		expect(optimizedImageUrl(noUpload)).toBe(noUpload);
	});
});
