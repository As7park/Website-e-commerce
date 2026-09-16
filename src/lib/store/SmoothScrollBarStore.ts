import { writable } from 'svelte/store';
import type Scrollbar from 'smooth-scrollbar';

const enableLogging: boolean = false;
interface ScrollState {
	scrollX: number;
	scrollY: number;
	smoothScroll: Scrollbar | null;
}

const initialState: ScrollState = {
	scrollX: 0,
	scrollY: 0,
	smoothScroll: null
};

function createSmoothScrollBarStore(enableLogging: boolean) {
	const { subscribe, set, update } = writable<ScrollState>(initialState);

	return {
		subscribe,
		set(value: ScrollState) {
			if (enableLogging) {
				// console.log('SmoothScrollBarStore set:', value);
			}
			set(value);
		},
		update(updater: (state: ScrollState) => ScrollState) {
			update((state) => {
				const newState = updater(state);
				if (enableLogging) {
					// console.log('SmoothScrollBarStore update:', newState);
				}
				return newState;
			});
		}
	};
}

// Pour activer les logs, passez `true` en paramètre
const SmoothScrollBarStore = createSmoothScrollBarStore(enableLogging);

export default SmoothScrollBarStore;
