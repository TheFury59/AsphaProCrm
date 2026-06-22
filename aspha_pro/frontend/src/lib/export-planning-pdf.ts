import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";

/**
 * Exporte le planning FullCalendar en PDF A4 paysage MULTI-PAGES.
 *
 * Objectif : voir l'INTÉGRALITÉ du planning (toutes les heures, tous les
 * jours), pas seulement la zone visible à l'écran.
 *
 * Le piège FullCalendar :
 *  - En vue timegrid, FullCalendar place les 24h dans un conteneur
 *    `.fc-scroller` avec `overflow: auto`. À l'écran, seule la portion
 *    correspondant à la position du scroll est visible (ex : 6h-14h si
 *    le user a scrollé là).
 *  - html2canvas capture le DOM tel qu'il est rendu : il ne déplie PAS
 *    les zones cachées par un overflow. Résultat : le PDF ne montrait
 *    que la tranche horaire actuellement scrollée.
 *
 * Fix : on injecte un <style> temporaire qui force `.fc-scroller` à
 * `overflow:visible; height:auto` ET la view-harness en `position:static;
 * height:auto`. Toute la grille passe dans le flux normal et html2canvas
 * peut la capturer en entier. Style retiré après capture (finally) pour
 * ne pas casser l'UI.
 *
 * Découpe multi-pages :
 *  - Canvas master haute résolution (scale 1.5).
 *  - Chaque page A4 paysage contient une portion VERTICALE distincte
 *    du canvas, copiée dans un canvas temporaire via drawImage(offset).
 */
export async function exportPlanningToPdf(
  element: HTMLElement,
  filename: string,
  title?: string,
): Promise<void> {
  // Déplie tous les scrollers de FullCalendar pour que la grille
  // complète (24h × 7 jours en timeGridWeek) entre dans le DOM rendu.
  const styleEl = document.createElement("style");
  styleEl.id = "pdf-export-fc-expand";
  styleEl.textContent = `
    .fc { height: auto !important; }
    .fc-view-harness,
    .fc-view-harness-active {
      height: auto !important;
      position: static !important;
    }
    .fc-scroller {
      overflow: visible !important;
      height: auto !important;
      max-height: none !important;
    }
    .fc-scroller-liquid,
    .fc-scroller-liquid-absolute {
      position: static !important;
      height: auto !important;
    }
    .fc-scrollgrid-section-body,
    .fc-scrollgrid-section-liquid,
    .fc-scrollgrid-liquid {
      height: auto !important;
    }
    .fc-timegrid-body,
    .fc-daygrid-body {
      height: auto !important;
    }
  `;
  document.head.appendChild(styleEl);

  // Force reflow + un frame pour que le layout se recalcule avant capture.
  void element.offsetHeight;
  await new Promise<void>((r) => requestAnimationFrame(() => r()));

  try {
    const target =
      (element.querySelector(".fc-view-harness") as HTMLElement | null) ?? element;

    const canvas = await html2canvas(target, {
      scale: 1.5,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });

    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth(); // 297 mm
    const pageH = pdf.internal.pageSize.getHeight(); // 210 mm
    const margin = 10;
    const titleH = title ? 10 : 0;
    const availW = pageW - margin * 2;
    const availH = pageH - margin * 2 - titleH;

    const pxPerMm = canvas.width / availW;
    const pageContentPx = availH * pxPerMm;
    const totalPages = Math.max(1, Math.ceil(canvas.height / pageContentPx));

    for (let i = 0; i < totalPages; i++) {
      if (i > 0) pdf.addPage();

      if (title) {
        pdf.setFontSize(12);
        pdf.setTextColor(40, 40, 40);
        const pageTitle =
          totalPages > 1 ? `${title} (page ${i + 1}/${totalPages})` : title;
        pdf.text(pageTitle, pageW / 2, margin + 5, { align: "center" });
      }

      const srcY = i * pageContentPx;
      const srcHeight = Math.min(pageContentPx, canvas.height - srcY);

      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = srcHeight;
      const ctx = sliceCanvas.getContext("2d");
      if (!ctx) continue;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      ctx.drawImage(canvas, 0, -srcY);

      const sliceData = sliceCanvas.toDataURL("image/jpeg", 0.92);
      const sliceHeightMm = srcHeight / pxPerMm;

      pdf.addImage(sliceData, "JPEG", margin, margin + titleH, availW, sliceHeightMm);
    }

    pdf.save(filename);
  } finally {
    // Toujours retirer le style override, même si une exception est levée
    // pendant la capture (sinon l'UI reste cassée).
    styleEl.remove();
  }
}
