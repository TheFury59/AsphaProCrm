import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";

/**
 * Exporte le planning FullCalendar en PDF A4 paysage MULTI-PAGES.
 *
 * Objectif : voir l'INTÉGRALITÉ du planning (toutes les heures, tous les
 * jours), pas seulement la zone visible à l'écran.
 *
 * Pièges FullCalendar v6 qu'on doit défaire avant la capture :
 *  1. `.fc-view-harness` a une hauteur fixée inline en JS (style="height:..").
 *     On override avec !important.
 *  2. `.fc-view` est en `position: absolute; inset: 0` → si on retire la
 *     hauteur du parent SANS passer la vue en `position: relative`, le
 *     parent collapse à 0 (l'enfant absolute ne pousse plus la hauteur).
 *  3. `.fc-scroller` a `overflow: auto` et masque le contenu hors viewport.
 *     html2canvas ne capture QUE ce qui est dans le DOM rendu, donc on
 *     doit déplier avec `overflow: visible; height: auto`.
 *  4. `.fc-scroller-liquid-absolute` est aussi en position absolute, idem.
 *
 * Sans ces overrides, le canvas produit fait 0px de haut → erreur
 * `drawImage … width or height of 0`. C'est ce bug-là qu'on corrige.
 */
export async function exportPlanningToPdf(
  element: HTMLElement,
  filename: string,
  title?: string,
): Promise<void> {
  const styleEl = document.createElement("style");
  styleEl.id = "pdf-export-fc-expand";
  styleEl.textContent = `
    .fc {
      height: auto !important;
      max-height: none !important;
    }
    .fc-view-harness {
      height: auto !important;
      max-height: none !important;
      position: relative !important;
    }
    .fc-view,
    .fc-view-harness > .fc-view {
      position: relative !important;
      inset: auto !important;
      top: auto !important;
      left: auto !important;
      right: auto !important;
      bottom: auto !important;
      height: auto !important;
    }
    .fc-scroller {
      overflow: visible !important;
      height: auto !important;
      max-height: none !important;
    }
    .fc-scroller-liquid,
    .fc-scroller-liquid-absolute {
      position: relative !important;
      inset: auto !important;
      top: auto !important;
      left: auto !important;
      right: auto !important;
      bottom: auto !important;
      height: auto !important;
    }
    .fc-scrollgrid,
    .fc-scrollgrid-section,
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
    // On capture le wrapper externe (et non `.fc-view-harness`) pour
    // inclure ce qui pourrait avoir débordé. La hauteur réelle vient de
    // scrollHeight, plus fiable que offsetHeight ici.
    const target = element;
    const captureWidth = target.scrollWidth || target.offsetWidth;
    const captureHeight = target.scrollHeight || target.offsetHeight;

    if (captureWidth === 0 || captureHeight === 0) {
      throw new Error(
        `Zone planning vide (${captureWidth}×${captureHeight}). Charge la vue avant l'export.`,
      );
    }

    const canvas = await html2canvas(target, {
      scale: 1.5,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      width: captureWidth,
      height: captureHeight,
      windowWidth: captureWidth,
      windowHeight: captureHeight,
    });

    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error(
        "html2canvas a produit un canvas vide. Réessaie après avoir scrollé en haut du planning.",
      );
    }

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
      if (srcHeight <= 0) continue;

      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = Math.ceil(srcHeight);
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
    styleEl.remove();
  }
}
