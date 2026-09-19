// lib/mediaStore.ts
import { readable } from 'svelte/store';

export function media(query: string) {
	return readable(false, (set) => {
		if (typeof window === 'undefined') return; // SSR-safe
		const mql = window.matchMedia(query);
		set(mql.matches);

		const onChange = (e: MediaQueryListEvent) => set(e.matches);
		mql.addEventListener('change', onChange);
		return () => mql.removeEventListener('change', onChange);
	});
}

export const isSmall = media('(max-width: 1000px)');
