/**
 * Récupère le logo vendeur (`InvoiceCompany.logoUrl`, upload Cloudinary
 * depuis `/admin/identite`) pour l'intégrer dans un PDF via `jsPDF#addImage`
 * — qui a besoin des octets de l'image, pas d'une URL. Best-effort : une
 * facture doit toujours pouvoir se générer même si l'image est
 * momentanément injoignable, jamais bloquant pour cette raison.
 */
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

export type PdfLogo = { dataUri: string; format: 'PNG' | 'JPEG' };

export async function fetchLogoForPdf(logoUrl: string | null): Promise<PdfLogo | null> {
	if (!logoUrl) return null;

	try {
		const response = await fetch(logoUrl);
		if (!response.ok) return null;

		const contentType = response.headers.get('content-type') ?? '';
		const format = contentType.includes('png')
			? 'PNG'
			: contentType.includes('jpeg') || contentType.includes('jpg')
				? 'JPEG'
				: null;
		if (!format) return null;

		const buffer = await response.arrayBuffer();
		if (buffer.byteLength > MAX_LOGO_BYTES) return null;

		const base64 = Buffer.from(buffer).toString('base64');
		return { dataUri: `data:${contentType};base64,${base64}`, format };
	} catch (error) {
		console.error('Error fetching company logo for PDF:', error);
		return null;
	}
}
