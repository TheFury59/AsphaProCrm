import { useRef, useState } from "react";
import { Download, Printer, FileText, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { QrCode } from "@/hooks/use-operations";
import { printQrCodesToPdf } from "@/lib/qr-print-pdf";

type QrDisplayDialogProps = {
  qr: QrCode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Affiche le QR plein écran avec le code en clair + actions
 * (téléchargement PNG, impression).
 *
 * `qrcode.react` génère un <svg> qu'on convertit en PNG côté client via canvas
 * pour le téléchargement (pas besoin d'aller au backend).
 */
export function QrDisplayDialog({ qr, open, onOpenChange }: QrDisplayDialogProps) {
  const svgWrapperRef = useRef<HTMLDivElement>(null);
  // État pour le téléchargement planche A4 (35 vignettes par défaut).
  const [copies, setCopies] = useState(35);
  const [printingPdf, setPrintingPdf] = useState(false);

  if (!qr) return null;

  const handleDownload = () => {
    const svg = svgWrapperRef.current?.querySelector("svg");
    if (!svg) {
      toast.error("QR introuvable dans le DOM.");
      console.error("[QrDisplayDialog] SVG node missing");
      return;
    }
    try {
      const xml = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const size = 1024; // export haute résolution
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("canvas context null");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, size, size);
          ctx.drawImage(img, 0, 0, size, size);
          const png = canvas.toDataURL("image/png");
          const a = document.createElement("a");
          a.href = png;
          a.download = `qr-${qr.code}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (err) {
          toast.error("Impossible de générer le PNG.");
          console.error("[QrDisplayDialog] PNG conversion failed", err);
        }
      };
      img.onerror = (err) => {
        toast.error("Erreur de chargement du SVG.");
        console.error("[QrDisplayDialog] svg → img failed", err);
      };
      img.src = url;
    } catch (err) {
      toast.error("Erreur lors du téléchargement.");
      console.error("[QrDisplayDialog] download error", err);
    }
  };

  const handlePrint = () => {
    try {
      const svg = svgWrapperRef.current?.querySelector("svg");
      if (!svg) {
        toast.error("QR introuvable.");
        console.error("[QrDisplayDialog] SVG node missing for print");
        return;
      }
      const xml = new XMLSerializer().serializeToString(svg);
      const clientName = qr.address?.client?.company_name ?? qr.address?.client?.code ?? "";
      const addr = qr.address
        ? `${qr.address.address ?? ""} ${qr.address.postal_code ?? ""} ${qr.address.city ?? ""}`.trim()
        : "";
      const win = window.open("", "_blank", "width=600,height=800,noopener,noreferrer");
      if (!win) {
        toast.error("Impossible d'ouvrir la fenêtre d'impression (popup bloqué ?)");
        return;
      }
      win.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>QR ${qr.code}</title>
<style>
  body { font-family: system-ui, sans-serif; text-align: center; padding: 24px; }
  .qr { width: 360px; height: 360px; margin: 16px auto; }
  .qr svg { width: 100%; height: 100%; }
  h1 { font-size: 18px; margin: 8px 0; }
  p { margin: 4px 0; color: #444; }
  code { font-family: ui-monospace, monospace; font-size: 14px; }
</style></head><body>
<h1>${clientName || "Aspha Pro — Télégestion"}</h1>
<p>${addr}</p>
<div class="qr">${xml}</div>
<p><code>${qr.code}</code></p>
<script>window.onload = () => { window.print(); };</script>
</body></html>`);
      win.document.close();
    } catch (err) {
      toast.error("Erreur d'impression.");
      console.error("[QrDisplayDialog] print error", err);
    }
  };

  const clientLabel =
    qr.address?.client?.company_name ?? qr.address?.client?.code ?? "—";
  const addrLabel = qr.address
    ? `${qr.address.address ?? ""}, ${qr.address.postal_code ?? ""} ${qr.address.city ?? ""}`.trim()
    : "—";

  /**
   * Génère la planche PDF A4 portrait avec N copies du QR (défaut 35).
   * Chaque vignette = nom client en haut, QR au milieu, code de secours en bas.
   * Pré-découpé en pointillés pour la cliente qui imprime sur autocollants.
   */
  const handleDownloadSheet = async () => {
    setPrintingPdf(true);
    try {
      await printQrCodesToPdf({
        qrCode: qr.code,
        clientName: clientLabel,
        addressLabel: qr.address
          ? [qr.address.address, qr.address.postal_code, qr.address.city]
              .filter(Boolean)
              .join(" · ")
          : undefined,
        copies,
      });
      toast.success(`Planche PDF téléchargée (${copies} copies)`);
    } catch (err) {
      console.error("[QrDisplayDialog] PDF planche failed", err);
      toast.error("Génération PDF impossible. Réessaie.");
    } finally {
      setPrintingPdf(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>QR code — {clientLabel}</DialogTitle>
          <DialogDescription>{addrLabel}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <div
            ref={svgWrapperRef}
            className="rounded-md border bg-white p-4"
            style={{ width: 320, height: 320 }}
          >
            <QRCodeSVG
              value={qr.code}
              size={288}
              level="M"
              includeMargin={false}
            />
          </div>
          <code className="font-mono text-sm">{qr.code}</code>
        </div>

        {/* Bloc planche A4 = scénario principal demandé par la cliente :
            imprimer une planche d'autocollants à coller sur les sites. */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium">Planche A4 d'autocollants</div>
              <div className="text-[11px] text-muted-foreground">
                Nom client en haut, QR au milieu, code de secours en bas.
                Bordures pointillées pour la découpe.
              </div>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="qr-copies" className="text-[11px]">
                Nombre de vignettes par page
              </Label>
              <Input
                id="qr-copies"
                type="number"
                min={1}
                max={70}
                value={copies}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n >= 1 && n <= 70) setCopies(n);
                }}
                className="h-8"
              />
            </div>
            <Button
              type="button"
              onClick={handleDownloadSheet}
              disabled={printingPdf}
              className="bg-gradient-aspha text-white border-0 hover:opacity-90"
            >
              {printingPdf ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Génération…
                </>
              ) : (
                <>
                  <Download className="mr-2 h-3.5 w-3.5" />
                  Télécharger PDF
                </>
              )}
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-2 h-3.5 w-3.5" />
            Imprimer 1 (navigateur)
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
            <Download className="mr-2 h-3.5 w-3.5" />
            Télécharger 1 PNG
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
