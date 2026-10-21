/* =========================================================
   FX BOUTIQUE — smooth scroll (Lenis), barre de progression,
   fondus de fond entre sections, parallaxe des grilles.
   Porté depuis les blocs "FX" de la maquette statique.

   ⚠ SmoothScrollBar (tiroir panier, admin) appelle
   `ScrollTrigger.defaults({ scroller, pinType: 'transform' })`
   en global : chaque ScrollTrigger de la boutique passe donc
   par `onWindow()` pour viser explicitement la fenêtre.
   ========================================================= */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

export function prefersReducedMotion(): boolean {
	return (
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
	);
}

/** Options ScrollTrigger ancrées sur la fenêtre (voir l'avertissement en tête). */
export function onWindow<T extends ScrollTrigger.Vars>(vars: T): T {
	return { scroller: window, ...(vars.pin ? { pinType: 'fixed' as const } : {}), ...vars };
}

/* ---------- Vitesse de scroll partagée (rubans, textes inclinés) ---------- */
let lastScrollY = 0;
let scrollDelta = 0;

/** Déplacement vertical (px) depuis la frame précédente, lissé. */
export function getScrollDelta(): number {
	return scrollDelta;
}

/* ---------- Smooth scroll + barre de progression ---------- */
let lenis: Lenis | null = null;

/**
 * Démarre le smooth scroll de la boutique et la barre de progression.
 * Renvoie la fonction de nettoyage (à appeler au démontage du shell).
 */
export function startShopScroll(progressBar: HTMLElement | null): () => void {
	const reduce = prefersReducedMotion();

	if (!reduce) {
		lenis = new Lenis({
			lerp: 0.085,
			smoothWheel: true,
			// Dialogues (tiroir panier, recherche, menus) : défilement natif.
			prevent: (node) =>
				node.hasAttribute?.('data-lenis-prevent') || node.getAttribute?.('role') === 'dialog'
		});
		lenis.on('scroll', ScrollTrigger.update);
	}

	const tick = (time: number) => {
		lenis?.raf(time * 1000);
		const y = window.scrollY;
		scrollDelta += (y - lastScrollY - scrollDelta) * 0.25;
		lastScrollY = y;
		if (progressBar) {
			const max = document.documentElement.scrollHeight - window.innerHeight;
			progressBar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
		}
	};
	gsap.ticker.add(tick);
	gsap.ticker.lagSmoothing(0);

	// Les images et les sections épinglées changent la hauteur de la page
	// après coup : on recalcule les déclencheurs quand le contenu bouge.
	let refreshTimer: ReturnType<typeof setTimeout>;
	const resizeObserver = new ResizeObserver(() => {
		clearTimeout(refreshTimer);
		refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 200);
	});
	resizeObserver.observe(document.body);

	return () => {
		gsap.ticker.remove(tick);
		resizeObserver.disconnect();
		clearTimeout(refreshTimer);
		lenis?.destroy();
		lenis = null;
	};
}

/** À appeler après chaque navigation SvelteKit : coupe l'inertie en cours. */
export function syncShopScroll() {
	lenis?.scrollTo(window.scrollY, { immediate: true, force: true });
	lastScrollY = window.scrollY;
	scrollDelta = 0;
	ScrollTrigger.refresh();
}

/* ---------- Fondus de couleur de fond entre sections ---------- */
function paintScope(color: string | null) {
	const scope = document.getElementById('shop-scope');
	if (!scope) return;
	if (color === null) {
		gsap.killTweensOf(scope, 'backgroundColor');
		scope.style.backgroundColor = '';
		return;
	}
	gsap.to(scope, { backgroundColor: color, duration: 1.2, ease: 'power2.out', overwrite: 'auto' });
}

/**
 * Action : teinte le fond de la boutique quand la section est au centre de
 * l'écran (équivalent de l'attribut `data-bg` de la maquette).
 */
export function sectionBg(node: HTMLElement, color: string) {
	if (prefersReducedMotion()) return {};
	let current = color;
	const trigger = ScrollTrigger.create(
		onWindow({
			trigger: node,
			start: 'top 70%',
			end: 'bottom 30%',
			onToggle: (self) => {
				if (self.isActive) paintScope(current);
			}
		})
	);
	return {
		update(next: string) {
			current = next;
		},
		destroy() {
			trigger.kill();
			paintScope(null);
		}
	};
}

/**
 * Action posée sur une grille : chaque carte `.shop-card` dérive
 * verticalement à sa propre vitesse selon sa colonne (parallaxe de la
 * maquette). Le paramètre sert seulement à relancer le calcul quand la
 * liste de cartes change (filtres, pagination).
 */
export function gridParallax(node: HTMLElement, _items?: unknown) {
	if (prefersReducedMotion()) return {};
	const colShift = [40, -30, 60, -10];
	let tweens: gsap.core.Tween[] = [];

	function build() {
		for (const tween of tweens) {
			tween.scrollTrigger?.kill();
			tween.kill();
		}
		tweens = [];
		// Une seule colonne sur mobile : pas de décalage entre cartes.
		if (window.matchMedia('(max-width: 600px)').matches) return;
		node.querySelectorAll<HTMLElement>('.shop-card').forEach((card, i) => {
			tweens.push(
				gsap.fromTo(
					card,
					{ '--py': '0px' },
					{
						'--py': `${colShift[i % 4]}px`,
						ease: 'none',
						scrollTrigger: onWindow({
							trigger: node,
							start: 'top bottom',
							end: 'bottom top',
							scrub: true
						})
					}
				)
			);
		});
	}
	build();

	return {
		update() {
			build();
		},
		destroy() {
			for (const tween of tweens) {
				tween.scrollTrigger?.kill();
				tween.kill();
			}
		}
	};
}
