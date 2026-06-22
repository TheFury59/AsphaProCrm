import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";

/**
 * Exporte le planning FullCalendar en PDF A4 paysage, sur UNE seule page.
 *
 * Pourquoi 1 page : un planning par mois ou semaine tient parfaitement sur
 * du A4 paysage si on fit l'image en ratio préservé. Multi-pages = capture
 * du scroll interne du calendrier (timegrid 24h) → canvas géant → 127 pages
 * de 12 Mo. Refusé.
 *
 * Pourquoi `html2canvas-pro` : Tailwind v4 utilise massivement `oklch()` que
 * le html2canvas original ne sait pas parser → tout le PDF devient
 * blanc/cassé. Le fork "pro" gère oklch, lch, color-mix et les CSS modernes.
 *
 * Stratégie :
 *  1. Capture le `.fc-view-harness` (le vrai contenant de la vue active),
 *     pas le wrapper `.fc` qui inclut le scroll interne.
 *  2. Scale 1.5 — bon compromis qualité/poids (vs scale 2 qui doublait la
 *     taille pour un gain de netteté marginal en impression A4).
 *  3. JPEG 92% au lieu de PNG → ~5-10× plus léger sans dégradation visible.
 *  4. Fit + center dans la page en préservant le ratio (pas d'étirement).
 */
export async function exportPlanningToPdf(
  element: HTMLElement,
  filename: string,
  title?: string,
): Promise<void> {
  // Cible plus précise : le contenant de la vue active. FullCalendar
  // organise toujours sa vue active dans `.fc-view-harness`, à l'intérieur
  // du wrapper `.fc`. Si non trouvé (cas edge), fallback sur element.
  const target =
    (element.querySelector(".fc-view-harness") as HTMLElement | null) ?? element;

  const canvas = await html2canvas(target, {
    scale: 1.5,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
    // Pas de windowHeight/windowWidth : on laisse html2canvas capturer la
    // taille naturelle du conteneur. Forcer scrollHeight produit un canvas
    // énorme quand l'élément a un overflow auto (FullCalendar timegrid).
  });
  const imgData = canvas.toDataURL("image/jpeg", 0.92);

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth(); // 297
  const pageH = pdf.internal.pageSize.getHeight(); // 210
  const margin = 10;
  const titleH = title ? 10 : 0; // espace réservé pour le titre en haut
  const availW = pageW - margin * 2;
  const availH = pageH - margin * 2 - titleH;

  // Préserve le ratio de l'image : on fit soit en width soit en height
  // selon laquelle est la plus contraignante. Pas de déformation.
  const canvasRatio = canvas.width / canvas.height;
  const pageRatio = availW / availH;
  let imgWidth: number;
  let imgHeight: number;
  if (canvasRatio > pageRatio) {
    // L'image est proportionnellement plus large que la page → on fit width.
    imgWidth = availW;
    imgHeight = availW / canvasRatio;
  } else {
    // L'image est proportionnellement plus haute → on fit height.
    imgHeight = availH;
    imgWidth = availH * canvasRatio;
  }

  // Titre optionnel en haut de page (centré, sobre).
  if (title) {
    pdf.setFontSize(12);
    pdf.setTextColor(40, 40, 40);
    pdf.text(title, pageW / 2, margin + 5, { align: "center" });
  }

  // Centrer l'image dans l'espace disponible.
  const x = margin + (availW - imgWidth) / 2;
  const y = margin + titleH + (availH - imgHeight) / 2;
  pdf.addImage(imgData, "JPEG", x, y, imgWidth, imgHeight);

  pdf.save(filename);
}
