import { createRoot } from "react-dom/client";
import { QRCodeCanvas } from "qrcode.react";
import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";

/**
 * Génère et télécharge un PDF A4 portrait contenant N copies du même QR code
 * (par défaut 35 = grille 5×7), chaque cellule affichant :
 *   - nom du client en haut
 *   - QR code au milieu
 *   - code de secours (texte du QR) en bas
 *
 * Cas d'usage : la cliente imprime la planche A4, découpe les vignettes et
 * en colle une à chaque site d'intervention (porte d'entrée, badgeuse, etc.).
 *
 * Pas de dépendance backend — on utilise `qrcode.react` (déjà installé) pour
 * rendre les QR dans un container offscreen, puis `html2canvas-pro` pour
 * capturer la page et `jspdf` pour la sauvegarder.
 */
type PrintOptions = {
  qrCode: string;
  clientName: string;
  /** Sous-titre optionnel (rue ou type d'adresse), affiché en petit sous le nom. */
  addressLabel?: string;
  /** Nombre de copies à imprimer. Défaut 35 (grille 5×7 sur A4 portrait). */
  copies?: number;
  filename?: string;
};

export async function printQrCodesToPdf({
  qrCode,
  clientName,
  addressLabel,
  copies = 35,
  filename,
}: PrintOptions): Promise<void> {
  // Container offscreen taille A4 portrait (210 × 297 mm).
  // Positionné à -9999px pour rester hors viewport sans casser le layout.
  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed;left:-9999px;top:0;width:210mm;height:297mm;" +
    "background:white;padding:10mm;box-sizing:border-box;" +
    "font-family:Arial,Helvetica,sans-serif;";
  document.body.appendChild(container);

  const root = createRoot(container);

  try {
    root.render(
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gridTemplateRows: "repeat(7, 1fr)",
          gap: "2mm",
          width: "100%",
          height: "100%",
        }}
      >
        {Array.from({ length: copies }).map((_, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "1.5mm",
              border: "0.4px dashed #b0b0b0",
              borderRadius: "1mm",
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                fontSize: "7pt",
                fontWeight: 700,
                textAlign: "center",
                lineHeight: 1.1,
                color: "#111",
                wordBreak: "break-word",
                maxWidth: "100%",
              }}
            >
              {clientName}
            </div>
            {addressLabel ? (
              <div
                style={{
                  fontSize: "5.5pt",
                  textAlign: "center",
                  color: "#666",
                  lineHeight: 1.1,
                  marginTop: "0.5mm",
                  wordBreak: "break-word",
                  maxWidth: "100%",
                }}
              >
                {addressLabel}
              </div>
            ) : null}
            <QRCodeCanvas value={qrCode} size={88} marginSize={0} />
            <div
              style={{
                fontSize: "5.5pt",
                fontFamily: "Consolas,Menlo,monospace",
                letterSpacing: "0.3px",
                textAlign: "center",
                lineHeight: 1.05,
                color: "#222",
                wordBreak: "break-all",
                maxWidth: "100%",
              }}
            >
              {qrCode}
            </div>
          </div>
        ))}
      </div>,
    );

    // Laisse React le temps de monter + le navigateur de peindre.
    // Sans ce délai html2canvas capture une page blanche.
    await new Promise<void>((r) =>
      setTimeout(() => requestAnimationFrame(() => r()), 80),
    );

    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: "#ffffff",
      logging: false,
      useCORS: true,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    pdf.addImage(imgData, "JPEG", 0, 0, 210, 297);

    const safeName = filename ?? `aspha-qr-${qrCode.slice(0, 10)}.pdf`;
    pdf.save(safeName);
  } finally {
    root.unmount();
    container.remove();
  }
}
