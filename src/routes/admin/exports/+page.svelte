<script lang="ts">
	import { Button } from '$shadcn/button';
	import { Input } from '$shadcn/input';
	import { Label } from '$shadcn/label';

	type Kind = 'sales' | 'users' | 'products' | 'blog' | 'promo' | 'contacts';

	const DATASETS: { kind: Kind; label: string; defaultDays: number; importable: boolean }[] = [
		{ kind: 'sales', label: 'Ventes', defaultDays: 365, importable: false },
		{ kind: 'users', label: 'Utilisateurs non vérifiés', defaultDays: 30, importable: true },
		{ kind: 'products', label: 'Produits', defaultDays: 365, importable: true },
		{ kind: 'blog', label: 'Articles de blog', defaultDays: 365, importable: true },
		{ kind: 'promo', label: 'Codes promo', defaultDays: 365, importable: true },
		{ kind: 'contacts', label: 'Messages de contact', defaultDays: 90, importable: true }
	];

	type PurgeState = {
		days: number;
		preview: number | null;
		previewBusy: boolean;
		purgeBusy: boolean;
		confirmText: string;
		message: string | null;
	};

	type ImportState = {
		files: FileList | undefined;
		busy: boolean;
		message: string | null;
	};

	let purgeState = $state<Record<Kind, PurgeState>>(
		Object.fromEntries(
			DATASETS.map((d) => [
				d.kind,
				{
					days: d.defaultDays,
					preview: null,
					previewBusy: false,
					purgeBusy: false,
					confirmText: '',
					message: null
				}
			])
		) as Record<Kind, PurgeState>
	);

	let importState = $state<Record<Kind, ImportState>>(
		Object.fromEntries(
			DATASETS.map((d) => [d.kind, { files: undefined, busy: false, message: null }])
		) as Record<Kind, ImportState>
	);

	async function preview(kind: Kind) {
		const s = purgeState[kind];
		s.previewBusy = true;
		s.message = null;
		try {
			const res = await fetch(`/admin/exports/${kind}/purge?days=${s.days}`);
			if (!res.ok) throw new Error(await res.text());
			const data = await res.json();
			s.preview = data.count;
		} catch (err) {
			s.message = err instanceof Error ? err.message : "Échec de l'aperçu.";
			s.preview = null;
		} finally {
			s.previewBusy = false;
		}
	}

	async function confirmPurge(kind: Kind) {
		const s = purgeState[kind];
		s.purgeBusy = true;
		s.message = null;
		try {
			const res = await fetch(`/admin/exports/${kind}/purge`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ days: s.days, confirmText: s.confirmText })
			});
			if (!res.ok) throw new Error(await res.text());
			const data = await res.json();
			s.message =
				`${data.deleted} ligne(s) supprimée(s)` +
				(data.skipped > 0 ? `, ${data.skipped} ignorée(s) (liées à des commandes)` : '.');
			s.preview = null;
			s.confirmText = '';
		} catch (err) {
			s.message = err instanceof Error ? err.message : 'Échec de la purge.';
		} finally {
			s.purgeBusy = false;
		}
	}

	async function doImport(kind: Kind) {
		const s = importState[kind];
		const file = s.files?.[0];
		if (!file) {
			s.message = 'Choisissez un fichier CSV.';
			return;
		}
		s.busy = true;
		s.message = null;
		try {
			const body = new FormData();
			body.set('file', file);
			const res = await fetch(`/admin/exports/${kind}/import`, { method: 'POST', body });
			if (!res.ok) throw new Error(await res.text());
			const data = await res.json();
			s.message = `${data.created} créé(s), ${data.updated} mis à jour${
				data.errors.length > 0 ? `, ${data.errors.length} erreur(s) : ${data.errors.slice(0, 3).join(' / ')}` : ''
			}`;
		} catch (err) {
			s.message = err instanceof Error ? err.message : "Échec de l'import.";
		} finally {
			s.busy = false;
		}
	}
</script>

<svelte:head>
	<title>Exports — Admin</title>
</svelte:head>

<div class="px-6 space-y-6 max-w-3xl">
	<div>
		<h1 class="text-2xl font-semibold">Données — export, purge, import</h1>
		<p class="text-sm text-muted-foreground">
			Purge : ciblée par ancienneté (`createdAt`), jamais un vidage total de table. Import :
			restaure un CSV exporté depuis cette même page (mêmes colonnes) — ne restaure ni les
			secrets (mot de passe, 2FA) ni les relations profondes (tags/commentaires de blog).
		</p>
	</div>

	{#each DATASETS as { kind, label, importable } (kind)}
		{@const p = purgeState[kind]}
		{@const i = importState[kind]}
		<div class="rounded-lg border p-4 space-y-4">
			<div class="flex items-center justify-between">
				<h2 class="text-lg font-medium">{label}</h2>
				<Button href="/admin/exports/{kind}" variant="outline">Exporter</Button>
			</div>

			<div class="space-y-2">
				<Label class="text-sm font-medium">Purger les lignes de plus de…</Label>
				<div class="flex flex-wrap items-center gap-2">
					<Input type="number" min="0" bind:value={p.days} class="w-24" />
					<span class="text-sm text-muted-foreground">jours</span>
					<Button variant="outline" disabled={p.previewBusy} onclick={() => preview(kind)}>
						{p.previewBusy ? 'Calcul…' : 'Prévisualiser'}
					</Button>
					{#if p.preview !== null}
						<span class="text-sm">
							{p.preview} ligne(s) concernée(s)
						</span>
						{#if kind === 'sales'}
							<Input
								type="text"
								placeholder="Tapez SUPPRIMER pour confirmer"
								bind:value={p.confirmText}
								class="w-64"
							/>
						{/if}
						<Button
							variant="destructive"
							disabled={p.purgeBusy || p.preview === 0 || (kind === 'sales' && p.confirmText !== 'SUPPRIMER')}
							onclick={() => confirmPurge(kind)}
						>
							{p.purgeBusy ? 'Suppression…' : 'Confirmer la suppression'}
						</Button>
					{/if}
				</div>
				{#if p.message}
					<p class="text-sm text-muted-foreground">{p.message}</p>
				{/if}
			</div>

			{#if importable}
				<div class="space-y-2 border-t pt-4">
					<Label class="text-sm font-medium">Importer (restauration)</Label>
					<div class="flex flex-wrap items-center gap-2">
						<Input type="file" accept=".csv" bind:files={i.files} class="w-64" />
						<Button variant="outline" disabled={i.busy} onclick={() => doImport(kind)}>
							{i.busy ? 'Import…' : 'Importer'}
						</Button>
					</div>
					{#if i.message}
						<p class="text-sm text-muted-foreground">{i.message}</p>
					{/if}
				</div>
			{/if}
		</div>
	{/each}
</div>
