<script lang="ts">
	import { Button } from '$shadcn/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$shadcn/card';
	import { AlertCircle } from 'lucide-svelte'; // Icône pour un effet visuel

	let { data } = $props();
</script>

<div class="w-screen h-screen ccc">
	<div class="w-[300px] mx-auto p-6 border shadow-lg rounded-lg backdrop-blur-3xl">
		<Card>
			<CardHeader>
				<div class="flex items-center space-x-2">
					<AlertCircle class="text-yellow-500" />
					<CardTitle>Recovery Code</CardTitle>
				</div>
			</CardHeader>
			<CardContent>
				<p class="mb-4 text-sm text-gray-600">
					Utilisez ce code de récupération si vous perdez l'accès à vos méthodes d'authentification
					à deux facteurs.
				</p>
				<div class="mb-4 p-4 bg-gray-100 rounded-lg border border-gray-300">
					<p class="text-lg font-mono text-center text-gray-600">{data.recoveryCode}</p>
				</div>
				<div class="flex justify-end">
					<a href="/auth/">
						<Button class="w-full" variant="outline">Continuer</Button>
					</a>
				</div>
			</CardContent>
		</Card>
	</div>
</div>
