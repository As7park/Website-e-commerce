<script lang="ts">
	import { page } from '$app/state';
	import * as Form from '$shadcn/form';
	import { Input } from '$shadcn/input';
	import { Button } from '$shadcn/button';
	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { updateMaterialSchema } from '$lib/schema/materials/materialSchema';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';

	let { data } = $props();
	let id = $derived(page.params.id);

	const updateMaterial = superForm(data.IupdateMaterialSchema, {
		validators: zodClient(updateMaterialSchema),
		id: 'updateMaterial'
	});

	const {
		form: updateMaterialData,
		enhance: updateMaterialEnhance,
		message: updateMaterialMessage
	} = updateMaterial;

	$effect(() => {
		if ($updateMaterialMessage === 'Material updated successfully') {
			toast.success('Matière mise à jour');
			setTimeout(() => goto('/admin/products'), 0);
		}
	});
</script>

<div class="ccc">
	<div class="m-5 p-5 border w-[400px]">
		<form method="POST" action="?/updateMaterial" use:updateMaterialEnhance class="space-y-4">
			<div class="ccs mt-5">
				<div class="w-[100%]">
					<Form.Field name="name" form={updateMaterial}>
						<Form.Control>
							<Form.Label>Nom</Form.Label>
							<Input name="name" type="text" bind:value={$updateMaterialData.name} />
						</Form.Control>
						<Form.FieldErrors />
					</Form.Field>
				</div>
			</div>
			<input type="hidden" name="id" value={id} />
			<Button type="submit">Save changes</Button>
		</form>
	</div>
</div>
