<script lang="ts">
	import { MoonIcon, SunIcon, Minimize2Icon, Maximize2Icon } from 'lucide-svelte';
	import { toggleMode } from 'mode-watcher';
	import { Switch } from '$shadcn/switch/index.js';

	const DARK_MODE_KEY = 'mode-watcher-mode';
	let darkMod = $state(false);
	let isFullscreen = $state(false);

	function updateFullscreenStatus() {
		isFullscreen = !!document.fullscreenElement;
	}

	function toggleFullscreen() {
		if (!document.fullscreenElement) {
			document.documentElement.requestFullscreen();
		} else {
			document.exitFullscreen();
		}
	}

	function toggleDarkMode() {
		// console.log('🌙 [Options] toggleDarkMode appelé, état avant:', {
		// 	darkMod,
		// 	localStorage: localStorage.getItem(DARK_MODE_KEY),
		// 	systemPreference: window.matchMedia('(prefers-color-scheme: dark)').matches
		// });

		toggleMode();

		// On attend un tick pour que mode-watcher mette à jour
		setTimeout(() => {
			const newDarkModeLocal = localStorage.getItem(DARK_MODE_KEY);
			const newState = newDarkModeLocal
				? newDarkModeLocal === 'dark'
				: window.matchMedia('(prefers-color-scheme: dark)').matches;

			// console.log('🌙 [Options] toggleDarkMode après:', {
			// 	darkMod,
			// 	newState,
			// 	localStorage: newDarkModeLocal,
			// 	systemPreference: window.matchMedia('(prefers-color-scheme: dark)').matches
			// });

			darkMod = newState;
		}, 50);
	}

	$effect(() => {
		const darkModeLocal = localStorage.getItem(DARK_MODE_KEY);
		const systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches;

		darkMod = darkModeLocal ? darkModeLocal === 'dark' : systemPreference;

		isFullscreen = !!document.fullscreenElement;

		document.addEventListener('fullscreenchange', updateFullscreenStatus);

		const keydownHandler = (e: KeyboardEvent) => {
			if (e.key === 'F11') {
				e.preventDefault();
				toggleFullscreen();
			}
		};
		window.addEventListener('keydown', keydownHandler);

		return () => {
			document.removeEventListener('fullscreenchange', updateFullscreenStatus);
			window.removeEventListener('keydown', keydownHandler);
		};
	});
</script>

<div class="rcc space-x-6 h-[100%]">
	<!-- Mode Sombre -->
	<div class="flex mx-4">
		<SunIcon class="h-5 w-5 text-yellow-500" />
		<Switch bind:checked={darkMod} onclick={toggleDarkMode} />
		<MoonIcon class="h-5 w-5 text-gray-500" />
	</div>

	<!-- Plein Écran -->
	<div class="flex mx-4" style="margin: 0;">
		<Maximize2Icon class="h-5 w-5" />
		<Switch bind:checked={isFullscreen} onclick={toggleFullscreen} />
		<Minimize2Icon class="h-5 w-5" />
	</div>
</div>
