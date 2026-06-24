import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";

/**
 * Exporte le planning FullCalendar en PDF A4 portrait **UNE seule page**.
 *
 * Stratégie : fit-to-page (le canvas entier — 24h × 7 jours, mois complet…)
 * est mis à l'échelle pour tenir intégralement sur une page A4 portrait, en
 * préservant le ratio. Plus jamais de découpage sauvage qui coupait un
 * RDV entre 2 pages : la cliente imprime 1 feuille = vue complète.
 *
 * Portrait choisi sur demande cliente : la vue semaine 24h × 7j fait une
 * grille très haute, le portrait colle mieux au ratio naturel du contenu
 * que le paysage (où on perdait beaucoup de vide horizontal).
 *
 * Pré-capture : on déplie les scrollers FullCalendar (overflow:auto)
 * pour que le DOM contienne TOUTE la grille (sinon html2canvas ne
 * capturerait que la portion visible). Style retiré dans `finally`.
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

  // Force reflow + frame pour que le layout intègre les overrides.
  void element.offsetHeight;
  await new Promise<void>((r) => requestAnimationFrame(() => r()));

  try {
    const target = element;
    const captureWidth = target.scrollWidth || target.offsetWidth;
    const captureHeight = target.scrollHeight || target.offsetHeight;

    if (captureWidth === 0 || captureHeight === 0) {
      throw new Error(
        `Zone planning vide (${captureWidth}×${captureHeight}). Charge la vue avant l'export.`,
      );
    }

    const canvas = await html2canvas(target, {
      scale: 2, // Bonne lisibilité même quand on shrink pour 1 page
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

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth(); // 210 mm (portrait)
    const pageH = pdf.internal.pageSize.getHeight(); // 297 mm (portrait)
    const margin = 8;
    const titleH = title ? 8 : 0;
    const availW = pageW - margin * 2;
    const availH = pageH - margin * 2 - titleH;

    // Fit-to-page en préservant le ratio : on choisit la dimension
    // contraignante (largeur OU hauteur selon le ratio du canvas) et
    // l'autre dimension est déduite. Le résultat est centré.
    const canvasRatio = canvas.width / canvas.height;
    const availRatio = availW / availH;
    let imgWidthMm: number;
    let imgHeightMm: number;
    if (canvasRatio > availRatio) {
      // Canvas plus large que la zone → largeur = contrainte
      imgWidthMm = availW;
      imgHeightMm = availW / canvasRatio;
    } else {
      // Canvas plus haut que la zone → hauteur = contrainte
      imgHeightMm = availH;
      imgWidthMm = availH * canvasRatio;
    }

    if (title) {
      pdf.setFontSize(11);
      pdf.setTextColor(40, 40, 40);
      pdf.text(title, pageW / 2, margin + 5, { align: "center" });
    }

    const x = margin + (availW - imgWidthMm) / 2;
    const y = margin + titleH + (availH - imgHeightMm) / 2;
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    pdf.addImage(imgData, "JPEG", x, y, imgWidthMm, imgHeightMm);

    pdf.save(filename);
  } finally {
    styleEl.remove();
  }
}
