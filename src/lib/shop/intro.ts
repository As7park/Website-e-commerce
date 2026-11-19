/* =========================================================
   OUVERTURE DE L'ACCUEIL — masque, trois bandes, hero.
   Les durées sont exprimées en vh de scroll : elles calent
   entre eux MaskIntro, RouteBands et HomeOpening, qui se
   chevauchent par marges négatives.

   Deux jeux de durées : ordinateur, et « compact » (téléphone,
   tablette). Au doigt, un geste parcourt un à deux écrans :
   la version ordinateur demanderait une trentaine de gestes
   avant la boutique. Le format compact garde tous les effets
   mais coupe surtout les pauses, un peu moins les mouvements.
   ========================================================= */
import { COMPACT_MQ, ScrollTrigger, isCompact } from './fx';

export { COMPACT_MQ, isCompact };

type Base = {
	/** Hauteur totale de l'intro masque (sa scène reste collée en haut). */
	MASK_RUN: number;
	/** Dissolution de l'image du masque au-dessus des bandes. */
	DISSOLVE: number;
	/** Bandes : entrée, passage d'une bande à l'autre, pause, ouverture sur le hero. */
	INTRO: number;
	MOVE: number;
	HOLD: number;
	EXIT: number;
	/** Hero épinglé : plaques une par une, temps de lecture, sortie. */
	PLATE: number;
	REST: number;
	LEAVE: number;
};

export type IntroTimings = Base & {
	BANDS_SPAN: number;
	HERO_SPAN: number;
	/**
	 * Remontée du bloc hero sous les bandes (marge négative) : il arrive en
	 * haut de l'écran au moment précis où les bandes commencent à s'ouvrir,
	 * c'est-à-dire EXIT + un écran avant la fin du bloc des bandes.
	 */
	HERO_OVERLAP: number;
};

function derive(b: Base): IntroTimings {
	return {
		...b,
		BANDS_SPAN: b.INTRO + (b.MOVE + b.HOLD) * 3 + b.EXIT,
		HERO_SPAN: b.EXIT + b.PLATE * 3 + b.REST + b.LEAVE,
		HERO_OVERLAP: 100 + b.EXIT
	};
}

/** Ordinateur : ~17 écrans de scroll jusqu'à la sortie du hero. */
export const FULL = derive({
	MASK_RUN: 830,
	DISSOLVE: 130,
	INTRO: 60,
	MOVE: 60,
	HOLD: 100,
	EXIT: 110,
	PLATE: 55,
	REST: 110,
	LEAVE: 90
});

/** Compact : ~9 écrans. Pauses divisées par trois, mouvements raccourcis d'un quart à un tiers. */
export const COMPACT = derive({
	MASK_RUN: 450,
	DISSOLVE: 70,
	INTRO: 30,
	MOVE: 45,
	HOLD: 35,
	EXIT: 70,
	PLATE: 30,
	REST: 45,
	LEAVE: 50
});

export function introTimings(): IntroTimings {
	return isCompact() ? COMPACT : FULL;
}

/**
 * Déclare deux variables CSS, `--{name}` (ordinateur) et `--{name}-c`
 * (compact) : les composants choisissent la bonne dans un `@media`, ce qui
 * garde le rendu serveur juste sans connaître l'appareil.
 */
export function spanVars(name: string, pick: (t: IntroTimings) => number): string {
	return `--${name}:${pick(FULL)}vh;--${name}-c:${pick(COMPACT)}vh`;
}

/**
 * Construit les animations avec les durées du format courant et les
 * reconstruit si l'on change de format (rotation, fenêtre redimensionnée).
 * `build` renvoie son nettoyage ; on renvoie celui de l'ensemble.
 */
export function withTimings(build: (t: IntroTimings) => () => void): () => void {
	const mq = window.matchMedia(COMPACT_MQ);
	let undo = build(introTimings());
	const onChange = () => {
		undo();
		undo = build(introTimings());
		ScrollTrigger.refresh();
	};
	mq.addEventListener('change', onChange);
	return () => {
		mq.removeEventListener('change', onChange);
		undo();
	};
}

/** Convertit des vh de scroll en pixels. */
export const vh = (n: number) => (window.innerHeight * n) / 100;

const SEEN_KEY = 'as7-intro-seen';

/** L'intro a-t-elle déjà été vue dans cette session ? */
export function introSeen(): boolean {
	try {
		return sessionStorage.getItem(SEEN_KEY) === '1';
	} catch {
		return false;
	}
}

export function markIntroSeen() {
	try {
		sessionStorage.setItem(SEEN_KEY, '1');
	} catch {
		/* stockage indisponible (navigation privée) : l'intro se rejouera */
	}
}
