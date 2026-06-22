import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";

/**
 * Exporte un élément DOM (le FullCalendar) en PDF A4 paysage.
 *
 * Pourquoi `html2canvas-pro` plutôt que `html2canvas` ? Tailwind v4 utilise
 * largement la fonction CSS `oklch()` que le html2canvas original ne sait
 * pas parser → tout le PDF devient blanc/cassé. Le fork "pro" gère oklch,
 * lch, color-mix et les CSS modernes.
 *
 * Stratégie :
 *  1. Capture l'élément à scale 2 (HD).
 *  2. A4 paysage = 297 × 210 mm.
 *  3. Si l'image rentre sur une page → on l'insère directement.
 *  4. Sinon → on slice verticalement en plusieurs pages.
 */
export async function exportPlanningToPdf(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    // Évite que le scroll interne de FullCalendar coupe le rendu.
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });
  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();   // 297
  const pageHeight = pdf.internal.pageSize.getHeight(); // 210
  const margin = 10;
  const imgWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  if (imgHeight <= pageHeight - margin * 2) {
    pdf.addImage(imgData, "PNG", margin, margin, imgWidth, imgHeight);
  } else {
    // Multi-pages : on positionne la même image en y négatif pour la "scroller".
    let position = 0;
    let remaining = imgHeight;
    while (remaining > 0) {
      pdf.addImage(imgData, "PNG", margin, margin - position, imgWidth, imgHeight);
      remaining -= pageHeight - margin * 2;
      position += pageHeight - margin * 2;
      if (remaining > 0) pdf.addPage();
    }
  }

  pdf.save(filename);
}
