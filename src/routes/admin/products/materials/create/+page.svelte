<script lang="ts">
	import * as Form from '$shadcn/form';
	import { Input } from '$shadcn/input';
	import { Button } from '$shadcn/button';
	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { createMaterialSchema } from '$lib/schema/materials/materialSchema';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';

	let { data } = $props();

	const createMaterial = superForm(data.IcreateMaterialSchema, {
		validators: zodClient(createMaterialSchema),
		id: 'createMaterial'
	});

	const {
		form: createMaterialData,
		enhance: createMaterialEnhance,
		message: createMaterialMessage
	} = createMaterial;

	$effect(() => {
		if ($createMaterialMessage === 'Material created successfully') {
			toast.success('Matière créée');
			setTimeout(() => goto('/admin/products'), 0);
		}
	});
</script>

<div class="ccc">
	<div class="m-5 p-5 border w-[400px]">
		<form method="POST" action="?/createMaterial" use:createMaterialEnhance class="space-y-4">
			<div class="ccs mt-5">
				<div class="w-[100%]">
					<Form.Field name="name" form={createMaterial}>
						<Form.Control>
							<Form.Label>Nom</Form.Label>
							<Input name="name" type="text" bind:value={$createMaterialData.name} />
						</Form.Control>
						<Form.FieldErrors />
					</Form.Field>
				</div>
			</div>
			<Button type="submit">Save changes</Button>
		</form>
	</div>
</div>
