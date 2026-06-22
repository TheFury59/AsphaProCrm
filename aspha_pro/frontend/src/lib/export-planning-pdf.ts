import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";

/**
 * Exporte le planning FullCalendar en PDF A4 paysage MULTI-PAGES si nécessaire.
 *
 * Objectif : voir l'INTÉGRALITÉ du planning dans le PDF, pas un aperçu réduit.
 *  - Vue MOIS : généralement 1 page (toute la grille tient sur A4 paysage)
 *  - Vue SEMAINE 24h × 7 jours : 2-4 pages selon la densité (slots 15 min →
 *    grille très haute, on slice verticalement en pages distinctes)
 *  - Vue JOUR 24h : 2-3 pages aussi
 *
 * Différence avec la 1ère version :
 *  - On slice le canvas en sections RÉELLEMENT DISTINCTES (chaque page
 *    contient une portion différente du planning) au lieu d'incruster la
 *    même image dupliquée avec un offset négatif (bug initial : 127 pages
 *    avec la même grille à chaque fois × 12 Mo).
 *
 * Stack :
 *  - `html2canvas-pro` gère oklch/lch/color-mix de Tailwind v4 (le original
 *    rendait des PDF blancs).
 *  - Scale 1.5 = bon compromis qualité/poids pour print A4.
 *  - JPEG 92% au lieu de PNG → ~5-10× plus léger.
 *  - Canvas temporaire par page pour extraire la bonne portion source.
 */
export async function exportPlanningToPdf(
  element: HTMLElement,
  filename: string,
  title?: string,
): Promise<void> {
  // Cible précise : le contenant de la vue active. FullCalendar place
  // toujours sa vue dans `.fc-view-harness`. Si absent (cas edge), on
  // capture le wrapper `element` tel quel.
  const target =
    (element.querySelector(".fc-view-harness") as HTMLElement | null) ?? element;

  // Capture pleine résolution. PAS de windowHeight forcé : on prend la
  // hauteur naturelle du contenu (24h dépliées en timegrid donnent un
  // canvas grand mais légitime — c'est le contenu à imprimer).
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
  const titleH = title ? 10 : 0; // espace réservé pour le titre en haut
  const availW = pageW - margin * 2;
  const availH = pageH - margin * 2 - titleH;

  // Combien de mm de hauteur d'image fait UN pixel du canvas, à la
  // largeur cible ? Sert à calculer combien de pixels du canvas tiennent
  // dans la hauteur disponible d'une page.
  const pxPerMm = canvas.width / availW;
  const pageContentPx = availH * pxPerMm;
  const totalPages = Math.max(1, Math.ceil(canvas.height / pageContentPx));

  for (let i = 0; i < totalPages; i++) {
    if (i > 0) pdf.addPage();

    // Titre en haut de chaque page (avec compteur si multi-pages).
    if (title) {
      pdf.setFontSize(12);
      pdf.setTextColor(40, 40, 40);
      const pageTitle =
        totalPages > 1 ? `${title} (page ${i + 1}/${totalPages})` : title;
      pdf.text(pageTitle, pageW / 2, margin + 5, { align: "center" });
    }

    // Extrait la portion du canvas master correspondant à cette page.
    const srcY = i * pageContentPx;
    const srcHeight = Math.min(pageContentPx, canvas.height - srcY);

    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = srcHeight;
    const ctx = sliceCanvas.getContext("2d");
    if (!ctx) continue;
    // Fond blanc pour ne pas avoir de transparence dans le JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    // Dessine SEULEMENT la portion utile en alignant le top du slice avec
    // le pixel `srcY` du canvas master (offset négatif).
    ctx.drawImage(canvas, 0, -srcY);

    const sliceData = sliceCanvas.toDataURL("image/jpeg", 0.92);
    const sliceHeightMm = srcHeight / pxPerMm;

    pdf.addImage(sliceData, "JPEG", margin, margin + titleH, availW, sliceHeightMm);
  }

  pdf.save(filename);
}
