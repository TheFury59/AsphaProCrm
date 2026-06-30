import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import {
  ArrowLeft, Printer, Search, Eraser, Grid3x3, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useQrCodes, type QrCode } from "@/hooks/use-operations";

/**
 * Éditeur de planche d'impression de QR codes.
 *
 *  - Sidebar gauche : tous les QR codes valides du CRM (recherche + drag).
 *  - Canvas droite : grille A4 portrait (lignes × colonnes configurables,
 *    défaut 5×7 = 35 vignettes).
 *  - Drag d'un QR dans une case, OU sélection d'un QR "actif" + remplissage
 *    ligne / colonne / toute la page.
 *
 * IMPRESSION (robuste) :
 *  La planche imprimée est rendue dans un PORTAIL React monté directement
 *  sur `document.body` (hors de #root). À l'impression, le CSS masque
 *  TOUT #root et n'affiche que ce portail, dimensionné en mm réels.
 *  → impossible d'avoir la duplication de page qu'on avait avec
 *    position:fixed (qui se répète sur chaque page en print Chrome) ou
 *    position:absolute (perturbée par les ancêtres du layout).
 */
export function QrPrintCanvasPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQrCodes({ status: "valid" });

  const [search, setSearch] = useState("");
  const [rows, setRows] = useState(7);
  const [cols, setCols] = useState(5);
  const [cells, setCells] = useState<(number | null)[]>(() => Array(35).fill(null));
  const [activeQrId, setActiveQrId] = useState<number | null>(null);

  const total = rows * cols;

  const resize = (nextRows: number, nextCols: number) => {
    const r = Math.max(1, Math.min(nextRows, 12));
    const c = Math.max(1, Math.min(nextCols, 8));
    setRows(r);
    setCols(c);
    setCells((prev) => {
      const next = Array(r * c).fill(null);
      for (let i = 0; i < Math.min(prev.length, next.length); i++) next[i] = prev[i];
      return next;
    });
  };

  const qrList = data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return qrList;
    return qrList.filter((qr) => {
      const name = qr.address?.client?.company_name ?? "";
      const code = qr.address?.client?.code ?? "";
      const addr = qr.address?.address ?? "";
      const city = qr.address?.city ?? "";
      return (
        name.toLowerCase().includes(q) ||
        code.toLowerCase().includes(q) ||
        addr.toLowerCase().includes(q) ||
        city.toLowerCase().includes(q) ||
        qr.code.toLowerCase().includes(q)
      );
    });
  }, [qrList, search]);

  const qrById = useMemo(() => {
    const m = new Map<number, QrCode>();
    qrList.forEach((qr) => m.set(qr.id, qr));
    return m;
  }, [qrList]);

  const nameOf = (qr: QrCode | null | undefined) =>
    qr?.address?.client?.company_name ?? qr?.address?.client?.code ?? "";

  const setCell = (index: number, qrId: number | null) => {
    setCells((prev) => {
      const next = [...prev];
      next[index] = qrId;
      return next;
    });
  };

  const fillRow = (rowIdx: number) => {
    if (!activeQrId) { toast.error("Sélectionne d'abord un QR dans la liste de gauche."); return; }
    setCells((prev) => {
      const next = [...prev];
      for (let c = 0; c < cols; c++) next[rowIdx * cols + c] = activeQrId;
      return next;
    });
  };

  const fillCol = (colIdx: number) => {
    if (!activeQrId) { toast.error("Sélectionne d'abord un QR dans la liste de gauche."); return; }
    setCells((prev) => {
      const next = [...prev];
      for (let r = 0; r < rows; r++) next[r * cols + colIdx] = activeQrId;
      return next;
    });
  };

  const fillAll = () => {
    if (!activeQrId) { toast.error("Sélectionne d'abord un QR dans la liste de gauche."); return; }
    setCells(Array(total).fill(activeQrId));
  };

  const clearAll = () => setCells(Array(total).fill(null));

  const filledCount = cells.filter((c) => c !== null).length;

  const handlePrint = () => {
    if (filledCount === 0) {
      toast.error("Place au moins un QR sur la planche avant d'imprimer.");
      return;
    }
    window.print();
  };

  // Dimensions vignette en mm (A4 portrait 210×297, marge 8mm).
  const PAGE_W = 210, PAGE_H = 297, MARGIN = 8;
  const cellW = (PAGE_W - MARGIN * 2) / cols;
  const cellH = (PAGE_H - MARGIN * 2) / rows;
  // QR ~70% de la plus petite dim de case, converti px (96dpi → 1mm≈3.78px).
  const qrPx = Math.max(56, Math.round(Math.min(cellW, cellH) * 0.7 * 3.78));
  // Largeur d'aperçu écran de la planche.
  const SCREEN_W = 700;
  const px = (mm: number) => mm * (SCREEN_W / PAGE_W);

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)]">
      {/* CSS impression : masque TOUT #root, n'affiche que le portail. */}
      <style>{`
        .qr-print-portal { display: none; }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; }
          #root { display: none !important; }
          .qr-print-portal { display: block !important; }
          .qr-print-sheet {
            width: 210mm; height: 297mm;
            padding: 8mm; box-sizing: border-box;
            margin: 0; overflow: hidden;
          }
          .qr-print-grid { display: grid; width: 100%; height: 100%; gap: 1mm; }
          .qr-print-cell {
            border: 0.25mm dashed #c0c0c0; border-radius: 1mm;
            display: flex; flex-direction: column;
            align-items: center; justify-content: space-between;
            padding: 1.5mm; overflow: hidden; box-sizing: border-box;
          }
          .qr-print-name {
            font-size: 9pt; font-weight: 700; text-align: center;
            line-height: 1.1; width: 100%;
            overflow: hidden; word-break: break-word;
          }
          .qr-print-code {
            font-size: 7pt; font-family: monospace; font-weight: 600;
            text-align: center; line-height: 1.1; width: 100%;
            word-break: break-all;
          }
        }
      `}</style>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap border-b pb-3 mb-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/telegestion")}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Retour
        </Button>
        <div className="flex items-center gap-1.5">
          <Grid3x3 className="h-4 w-4 text-muted-foreground" />
          <Label className="text-xs">Lignes</Label>
          <Input type="number" min={1} max={12} value={rows}
            onChange={(e) => resize(Number(e.target.value) || 1, cols)} className="h-8 w-16" />
          <Label className="text-xs ml-2">Colonnes</Label>
          <Input type="number" min={1} max={8} value={cols}
            onChange={(e) => resize(rows, Number(e.target.value) || 1)} className="h-8 w-16" />
          <span className="text-xs text-muted-foreground ml-1">= {total} cases</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{filledCount}/{total} remplies</span>
          <Button variant="outline" size="sm" onClick={fillAll} disabled={!activeQrId}>Tout remplir</Button>
          <Button variant="outline" size="sm" onClick={clearAll}>
            <Eraser className="h-3.5 w-3.5 mr-1" /> Vider
          </Button>
          <Button size="sm" onClick={handlePrint}
            className="bg-gradient-aspha text-white border-0 hover:opacity-90">
            <Printer className="h-3.5 w-3.5 mr-1" /> Imprimer
          </Button>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* ===== Sidebar ===== */}
        <div className="w-72 shrink-0 flex flex-col rounded-xl border bg-card overflow-hidden">
          <div className="p-3 border-b space-y-2">
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              QR codes du CRM
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher…" className="pl-7 h-8 text-sm" />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Glisse un QR dans une case, ou clique pour le sélectionner puis
              remplis une ligne/colonne.
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {isLoading && [...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}
            {!isLoading && filtered.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-8">Aucun QR code valide.</p>
            )}
            {filtered.map((qr) => {
              const isActive = activeQrId === qr.id;
              return (
                <button
                  key={qr.id}
                  type="button"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("qrId", String(qr.id))}
                  onClick={() => setActiveQrId(isActive ? null : qr.id)}
                  className={
                    "w-full flex items-center gap-2 rounded-lg border p-2 text-left transition-colors cursor-grab active:cursor-grabbing " +
                    (isActive ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "hover:bg-muted/50")
                  }
                  title="Glisser dans une case ou cliquer pour sélectionner"
                >
                  <div className="shrink-0 bg-white rounded p-0.5 border">
                    <QRCodeCanvas value={qr.code} size={34} marginSize={0} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate">{nameOf(qr) || "Sans client"}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{qr.address?.city ?? ""}</div>
                    <div className="text-[9px] font-mono text-muted-foreground truncate">{qr.code}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ===== Aperçu écran A4 (interactif) ===== */}
        <div className="flex-1 overflow-auto bg-muted/30 rounded-xl p-4 flex justify-center items-start">
          <div className="flex flex-col items-start gap-1">
            {/* Boutons remplir colonne */}
            <div className="flex" style={{ paddingLeft: "1.4rem" }}>
              {Array.from({ length: cols }).map((_, c) => (
                <div key={c} style={{ width: `${px(cellW)}px` }} className="flex justify-center">
                  <button type="button" onClick={() => fillCol(c)}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-muted hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                    title="Remplir cette colonne avec le QR sélectionné">
                    ↓ col {c + 1}
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-start gap-1">
              {/* Boutons remplir ligne */}
              <div className="flex flex-col">
                {Array.from({ length: rows }).map((_, r) => (
                  <div key={r} style={{ height: `${px(cellH)}px` }} className="flex items-center">
                    <button type="button" onClick={() => fillRow(r)}
                      className="text-[9px] px-1 py-0.5 rounded bg-muted hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                      title="Remplir cette ligne avec le QR sélectionné"
                      style={{ writingMode: "vertical-rl" }}>
                      → L{r + 1}
                    </button>
                  </div>
                ))}
              </div>

              {/* Planche aperçu (interactive, dans #root → cachée à l'impression) */}
              <div
                className="bg-white shadow-soft"
                style={{
                  width: `${SCREEN_W}px`,
                  height: `${SCREEN_W * (PAGE_H / PAGE_W)}px`,
                  padding: `${px(MARGIN)}px`,
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                    gridTemplateRows: `repeat(${rows}, 1fr)`,
                    width: "100%", height: "100%", gap: "1mm",
                  }}
                >
                  {cells.map((qrId, i) => {
                    const qr = qrId ? qrById.get(qrId) : null;
                    return (
                      <div
                        key={i}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const dropped = e.dataTransfer.getData("qrId");
                          if (dropped) setCell(i, Number(dropped));
                        }}
                        onClick={() => {
                          if (qrId) setCell(i, null);
                          else if (activeQrId) setCell(i, activeQrId);
                        }}
                        className={
                          "relative flex flex-col items-center justify-between text-center overflow-hidden cursor-pointer group border border-dashed " +
                          (qr ? "border-gray-300" : "border-gray-200 hover:border-primary/50 hover:bg-primary/5")
                        }
                        style={{ borderRadius: "2px", padding: "3px" }}
                      >
                        {qr ? (
                          <>
                            <div className="text-[10px] font-bold leading-tight line-clamp-2 px-0.5 w-full">
                              {nameOf(qr)}
                            </div>
                            <QRCodeCanvas value={qr.code} size={qrPx} marginSize={0} />
                            <div className="text-[8px] font-mono font-semibold leading-tight break-all px-0.5 w-full">
                              {qr.code}
                            </div>
                            <button type="button"
                              onClick={(e) => { e.stopPropagation(); setCell(i, null); }}
                              className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 bg-rose-500 text-white rounded-full p-0.5 transition-opacity"
                              title="Retirer">
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </>
                        ) : (
                          <span className="text-[9px] text-muted-foreground/40 m-auto">{i + 1}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Portail d'impression (hors #root, sur document.body) ===== */}
      {createPortal(
        <div className="qr-print-portal">
          <div className="qr-print-sheet">
            <div
              className="qr-print-grid"
              style={{
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gridTemplateRows: `repeat(${rows}, 1fr)`,
              }}
            >
              {cells.map((qrId, i) => {
                const qr = qrId ? qrById.get(qrId) : null;
                if (!qr) return <div key={i} className="qr-print-cell" />;
                return (
                  <div key={i} className="qr-print-cell">
                    <div className="qr-print-name">{nameOf(qr)}</div>
                    <QRCodeCanvas value={qr.code} size={qrPx} marginSize={0} />
                    <div className="qr-print-code">{qr.code}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
