<script lang="ts">
	import { formatDate } from '$lib/utils/formatDate';
	import * as Avatar from '$shadcn/avatar/index.js';
	import * as Card from '$shadcn/card/index.js';

	let { users } = $props();
</script>

<!-- Card qui liste les derniers inscrits -->
<Card.Root>
	<Card.Header>
		<Card.Title>Latest Registrations</Card.Title>
		<Card.Description>Recent users who have joined the platform</Card.Description>
	</Card.Header>
	<Card.Content class="grid gap-6">
		<!-- On boucle sur chaque user pour l'afficher dans un bloc similaire -->
		{#each users as user (user.id)}
			<div class="flex items-center justify-between space-x-4">
				<div class="flex items-center space-x-4">
					<Avatar.Root>
						{#if user.picture}
							<Avatar.Image src={user.picture} alt={user.name ?? user.email} />
						{:else}
							<Avatar.Fallback>
								{user.name?.[0] ?? user.email?.[0] ?? 'U'}
							</Avatar.Fallback>
						{/if}
					</Avatar.Root>

					<div>
						<p class="text-sm font-medium leading-none">
							{user.name ?? user.username ?? 'No Name'}
						</p>
						<p class="text-muted-foreground text-sm">{user.email}</p>
					</div>
				</div>

				<p class="text-sm max-w-[110px]">
					{#if user.createdAt}
						{formatDate(user.createdAt)}
					{/if}
				</p>
			</div>
		{/each}
	</Card.Content>
</Card.Root>
