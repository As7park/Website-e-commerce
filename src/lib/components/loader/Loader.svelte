<script lang="ts">
	import { fade } from 'svelte/transition';
</script>

<div
	class="bg-background fixed inset-0 z-[100] flex items-center justify-center"
	out:fade={{ duration: 280 }}
	role="status"
	aria-live="polite"
	aria-label="Chargement de l'application"
>
	<div class="flex flex-col items-center gap-4">
		<img src="/logo.svg" alt="" width="64" height="64" />
		<p
			class="text-2xl font-black tracking-wide italic uppercase [font-family:'Open_Sans_Variable',sans-serif]"
		>
			AS7 Park
		</p>
		<div class="bg-muted h-1 w-32 overflow-hidden rounded-full">
			<div class="h-full w-1/2 animate-pulse bg-[#ffb200]"></div>
		</div>
	</div>
</div>
