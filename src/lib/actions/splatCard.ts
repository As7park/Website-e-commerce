import { goto } from '$app/navigation';

/* =========================================================
   ÉLÉMENTS CLIQUABLES — projection de boue/liquide, nerveuse
   et abondante : mélange de gouttes rondes et de traînées
   étirées, générées au hasard à chaque clic, confinées à la
   dalle image. Porté depuis la maquette statique.
   ========================================================= */

function randomBlobRadius() {
	const r = () => 25 + Math.floor(Math.random() * 50);
	return `${r()}% ${r()}% ${r()}% ${r()}% / ${r()}% ${r()}% ${r()}% ${r()}%`;
}

function randomPolygon() {
	const points = 5 + Math.floor(Math.random() * 3);
	const pts: string[] = [];
	for (let i = 0; i < points; i++) {
		const angle = (i / points) * Math.PI * 2;
		const radius = 30 + Math.random() * 62;
		const x = 50 + Math.cos(angle) * radius * 0.5;
		const y = 50 + Math.sin(angle) * radius * 0.5;
		pts.push(`${x.toFixed(0)}% ${y.toFixed(0)}%`);
	}
	return `polygon(${pts.join(',')})`;
}

function buildMark(): HTMLSpanElement {
	const mark = document.createElement('span');
	mark.className = 'shop-splat-mark';

	const roll = Math.random();
	let w: number;
	let h: number;
	if (roll < 0.4) {
		const s = 2.5 + Math.random() * 5;
		w = s;
		h = s;
	} else if (roll < 0.75) {
		w = 7 + Math.random() * 8;
		h = w * (0.75 + Math.random() * 0.4);
	} else if (roll < 0.92) {
		w = 12 + Math.random() * 16;
		h = w * (0.22 + Math.random() * 0.2);
	} else {
		w = 16 + Math.random() * 10;
		h = w * (0.7 + Math.random() * 0.3);
	}

	mark.style.setProperty('--sw', `${w.toFixed(1)}px`);
	mark.style.setProperty('--sh', `${h.toFixed(1)}px`);
	mark.style.setProperty('--sx', `${(3 + Math.random() * 94).toFixed(1)}%`);
	mark.style.setProperty('--sy', `${(Math.random() * Math.random() * 42).toFixed(1)}%`);
	mark.style.setProperty('--srot', `${(Math.random() * 360).toFixed(0)}deg`);
	mark.style.setProperty('--sdelay', `${(Math.random() * 110).toFixed(0)}ms`);
	mark.style.setProperty('--sop', `${(0.72 + Math.random() * 0.26).toFixed(2)}`);

	if (Math.random() < 0.3) {
		mark.style.clipPath = randomPolygon();
	} else {
		mark.style.borderRadius = randomBlobRadius();
	}
	return mark;
}

/**
 * Action Svelte : attache l'effet de projection à une carte produit
 * (un <a class="shop-card"> contenant un .shop-ph) et navigue via
 * le routeur SvelteKit une fois l'animation lancée.
 */
export function splatCard(node: HTMLAnchorElement) {
	const ph = node.querySelector<HTMLElement>('.shop-ph');
	let navigating = false;

	if (ph) {
		const container = document.createElement('span');
		container.className = 'shop-card-splatter';
		const count = 22 + Math.floor(Math.random() * 14);
		for (let i = 0; i < count; i++) container.appendChild(buildMark());
		ph.appendChild(container);
	}

	function handleClick(e: MouseEvent) {
		if (navigating) return;
		const href = node.getAttribute('href');
		if (!href || href === '#') return;
		e.preventDefault();
		node.classList.add('shop-is-splatting');
		navigating = true;
		setTimeout(() => goto(href), 280);
	}

	node.addEventListener('click', handleClick);

	return {
		destroy() {
			node.removeEventListener('click', handleClick);
		}
	};
}
