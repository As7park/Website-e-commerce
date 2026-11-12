/* =========================================================
   OUVERTURE DE L'ACCUEIL — masque, trois bandes, hero.
   Les durées sont exprimées en vh de scroll : elles calent
   entre eux MaskIntro, RouteBands et HomeOpening, qui se
   chevauchent par marges négatives.
   ========================================================= */

/** Hauteur totale de l'intro masque (sa scène reste collée en haut). */
export const MASK_RUN = 830;
/** Dissolution de l'image du masque au-dessus des bandes. */
export const DISSOLVE = 130;
/** Bandes : entrée, passage d'une bande à l'autre, pause, ouverture sur le hero. */
export const INTRO = 60;
export const MOVE = 60;
export const HOLD = 100;
export const EXIT = 110;
export const BANDS_SPAN = INTRO + (MOVE + HOLD) * 3 + EXIT;
/** Hero épinglé : plaques une par une, temps de lecture, sortie. */
export const PLATE = 55;
export const REST = 110;
export const LEAVE = 90;
export const HERO_SPAN = EXIT + PLATE * 3 + REST + LEAVE;
/**
 * Remontée du bloc hero sous les bandes (marge négative) : il arrive en
 * haut de l'écran au moment précis où les bandes commencent à s'ouvrir,
 * c'est-à-dire EXIT + un écran avant la fin du bloc des bandes.
 */
export const HERO_OVERLAP = 100 + EXIT;

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
