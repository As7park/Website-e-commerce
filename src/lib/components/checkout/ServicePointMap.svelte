<script lang="ts">
	import { MapLibre, Marker, Popup } from 'svelte-maplibre-gl';
	import * as Card from '$shadcn/card/index.js';
	import { MapPin } from 'lucide-svelte';
	import type maplibregl from 'maplibre-gl';
	import type { ServicePointDTO } from '$lib/sendcloud/checkoutTypes';

	interface Props {
		showMap: boolean;
		isLoadingServicePoints: boolean;
		servicePoints: ServicePointDTO[];
		selectedPoint: ServicePointDTO | null;
		zoom: number;
		centerCoordinates: [number, number];
		offsets: maplibregl.Offset;
		onMarkerClick: (point: ServicePointDTO) => void;
	}

	let {
		showMap,
		isLoadingServicePoints,
		servicePoints,
		selectedPoint,
		zoom,
		centerCoordinates,
		offsets,
		onMarkerClick
	}: Props = $props();
</script>

{#if showMap}
	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<MapPin class="w-5 h-5" />
				Points relais disponibles
			</Card.Title>
		</Card.Header>
		<Card.Content>
			{#if isLoadingServicePoints}
				<div class="flex items-center justify-center h-[400px]">
					<div class="text-center">
						<div
							class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"
						></div>
						<p class="text-sm text-muted-foreground">Chargement des points relais...</p>
					</div>
				</div>
			{:else if servicePoints.length === 0}
				<div class="flex items-center justify-center h-[400px]">
					<div class="text-center">
						<MapPin class="w-12 h-12 text-muted-foreground mx-auto mb-2" />
						<p class="text-sm text-muted-foreground">Aucun point relais trouvé</p>
					</div>
				</div>
			{:else}
				<MapLibre
					class="w-full h-[400px] rounded-lg overflow-hidden"
					style="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
					{zoom}
					center={centerCoordinates}
				>
					{#each servicePoints as point}
						<Marker lnglat={[point.longitude, point.latitude]}>
							{#snippet content()}
								<!-- Visuel du marker -->
								<div class="bg-blue-600 text-white p-2 rounded cursor-pointer"></div>
							{/snippet}
							<!-- Popup à l'intérieur du Marker -->
							<Popup class="text-black" offset={offsets} open={selectedPoint?.id === point.id}>
								<div class="p-2">
									<h3 class="font-bold mb-1">{point.name}</h3>
									<p>Adresse : {point.street}</p>
									<p>{point.postal_code} {point.city}</p>
									<button onclick={() => onMarkerClick(point)}>Valider</button>
								</div>
							</Popup>
						</Marker>
					{/each}
				</MapLibre>
			{/if}

			{#if selectedPoint}
				<div class="mt-4 p-4 rounded-lg border bg-accent/50">
					<h3 class="font-semibold mb-2">Point relais sélectionné</h3>
					<p class="text-sm">{selectedPoint.name}</p>
					<p class="text-sm text-muted-foreground">
						{selectedPoint.street}, {selectedPoint.postal_code}
						{selectedPoint.city}
					</p>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
{/if}
