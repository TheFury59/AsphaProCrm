import { useRef } from "react";
import { Download, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { QrCode } from "@/hooks/use-operations";

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
      const win = window.open("", "_blank", "width=600,height=800");
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

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-3.5 w-3.5" />
            Imprimer
          </Button>
          <Button type="button" onClick={handleDownload}>
            <Download className="mr-2 h-3.5 w-3.5" />
            Télécharger PNG
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
