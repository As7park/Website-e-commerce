<script lang="ts">
	import InvoicePreview from '$lib/components/invoice/InvoicePreview.svelte';
	import OrderTrackingPanel from '$lib/components/invoice/OrderTrackingPanel.svelte';

	let { data } = $props();
</script>

<div class="mx-auto w-full max-w-4xl px-6 pt-6">
	<OrderTrackingPanel
		status={data.tracking.status}
		shippingMethodName={data.tracking.shippingMethodName}
		trackingNumber={data.tracking.trackingNumber}
		trackingUrl={data.tracking.trackingUrl}
		servicePointId={data.tracking.servicePointId}
		shippingStatusMessage={data.tracking.shippingStatusMessage}
	/>
</div>

<InvoicePreview
	invoice={data.invoice}
	pdfHref={data.pdfHref}
	backHref={data.backHref}
	backLabel={data.backLabel}
/>
