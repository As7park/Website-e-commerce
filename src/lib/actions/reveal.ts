/**
 * Action Svelte : révèle un élément (fade + translation) lorsqu'il entre
 * dans le viewport. Utilisé pour les animations d'apparition au scroll
 * des sections/grilles de la boutique.
 */
export function reveal(node: HTMLElement, options: { delay?: number; enabled?: boolean } = {}) {
	if (options.enabled === false) {
		return { update() {}, destroy() {} };
	}

	node.classList.add('shop-reveal');
	if (options.delay) {
		node.style.setProperty('--reveal-delay', `${options.delay}ms`);
	}

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					node.classList.add('shop-reveal-visible');
					observer.unobserve(node);
				}
			}
		},
		{ threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
	);

	observer.observe(node);

	return {
		update(newOptions: { delay?: number } = {}) {
			if (newOptions.delay) {
				node.style.setProperty('--reveal-delay', `${newOptions.delay}ms`);
			}
		},
		destroy() {
			observer.disconnect();
		}
	};
}
