import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import {
  ArrowLeft, Printer, Search, Trash2, Eraser, Grid3x3, X,
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
 * Workflow :
 *  - Sidebar gauche : tous les QR codes valides du CRM (recherche + drag).
 *  - Canvas droite : grille A4 portrait (lignes × colonnes configurables,
 *    défaut 5×7 = 35 vignettes).
 *  - On glisse un QR depuis la sidebar dans une case, OU on sélectionne un
 *    QR "actif" et on remplit une ligne / une colonne / toute la page d'un
 *    clic.
 *  - Bouton Imprimer → window.print() avec une feuille de style @media print
 *    calibrée en mm pour un rendu A4 exact (à imprimer sur autocollants).
 *
 * Chaque vignette = nom client (haut) + QR (milieu) + code de secours (bas).
 */
export function QrPrintCanvasPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQrCodes({ status: "valid" });

  const [search, setSearch] = useState("");
  const [rows, setRows] = useState(7);
  const [cols, setCols] = useState(5);
  // cells[i] = id du QR posé dans la case i (null = vide).
  const [cells, setCells] = useState<(number | null)[]>(() => Array(35).fill(null));
  // QR "actif" sélectionné dans la sidebar (pour le remplissage ligne/colonne).
  const [activeQrId, setActiveQrId] = useState<number | null>(null);

  const total = rows * cols;

  // Redimensionne la grille en préservant les cases déjà remplies.
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
    // Le CSS @media print (injecté plus bas) masque tout sauf #print-sheet.
    window.print();
  };

  // Dimensions vignette en mm (A4 portrait 210×297, marge 8mm).
  const PAGE_W = 210, PAGE_H = 297, MARGIN = 8;
  const cellW = (PAGE_W - MARGIN * 2) / cols;
  const cellH = (PAGE_H - MARGIN * 2) / rows;
  // Taille du QR : ~55% de la plus petite dimension de la case, en px (96dpi → 1mm≈3.78px).
  const qrPx = Math.max(40, Math.round(Math.min(cellW, cellH) * 0.55 * 3.78));

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)]">
      {/* Style d'impression : on cache tout sauf la planche, page A4 sans marge */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body * { visibility: hidden !important; }
          #print-sheet, #print-sheet * { visibility: visible !important; }
          #print-sheet {
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            margin: 0 !important; box-shadow: none !important;
            border: none !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print flex items-center gap-3 flex-wrap border-b pb-3 mb-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/telegestion")}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Retour
        </Button>
        <div className="flex items-center gap-1.5">
          <Grid3x3 className="h-4 w-4 text-muted-foreground" />
          <Label className="text-xs">Lignes</Label>
          <Input
            type="number" min={1} max={12} value={rows}
            onChange={(e) => resize(Number(e.target.value) || 1, cols)}
            className="h-8 w-16"
          />
          <Label className="text-xs ml-2">Colonnes</Label>
          <Input
            type="number" min={1} max={8} value={cols}
            onChange={(e) => resize(rows, Number(e.target.value) || 1)}
            className="h-8 w-16"
          />
          <span className="text-xs text-muted-foreground ml-1">= {total} cases</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{filledCount}/{total} remplies</span>
          <Button variant="outline" size="sm" onClick={fillAll} disabled={!activeQrId}>
            Tout remplir
          </Button>
          <Button variant="outline" size="sm" onClick={clearAll}>
            <Eraser className="h-3.5 w-3.5 mr-1" /> Vider
          </Button>
          <Button
            size="sm"
            onClick={handlePrint}
            className="bg-gradient-aspha text-white border-0 hover:opacity-90"
          >
            <Printer className="h-3.5 w-3.5 mr-1" /> Imprimer
          </Button>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* ===== Sidebar QR codes ===== */}
        <div className="no-print w-72 shrink-0 flex flex-col rounded-xl border bg-card overflow-hidden">
          <div className="p-3 border-b space-y-2">
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              QR codes du CRM
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher…"
                className="pl-7 h-8 text-sm"
              />
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
              const name = qr.address?.client?.company_name ?? qr.address?.client?.code ?? "Sans client";
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
                    <div className="text-xs font-medium truncate">{name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {qr.address?.city ?? ""}
                    </div>
                    <div className="text-[9px] font-mono text-muted-foreground truncate">{qr.code}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ===== Canvas A4 ===== */}
        <div className="flex-1 overflow-auto bg-muted/30 rounded-xl p-4 flex justify-center items-start">
          <div className="flex flex-col items-start gap-1">
            {/* Boutons "remplir colonne" alignés au-dessus de chaque colonne */}
            <div className="no-print flex" style={{ paddingLeft: "1.4rem" }}>
              {Array.from({ length: cols }).map((_, c) => (
                <div key={c} style={{ width: `${cellW * (700 / PAGE_W)}px` }} className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => fillCol(c)}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-muted hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                    title="Remplir cette colonne avec le QR sélectionné"
                  >
                    ↓ col {c + 1}
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-start gap-1">
              {/* Boutons "remplir ligne" à gauche de chaque ligne */}
              <div className="no-print flex flex-col">
                {Array.from({ length: rows }).map((_, r) => (
                  <div key={r} style={{ height: `${cellH * (700 / PAGE_W)}px` }} className="flex items-center">
                    <button
                      type="button"
                      onClick={() => fillRow(r)}
                      className="text-[9px] px-1 py-0.5 rounded bg-muted hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer writing-mode-vertical"
                      title="Remplir cette ligne avec le QR sélectionné"
                      style={{ writingMode: "vertical-rl" }}
                    >
                      → L{r + 1}
                    </button>
                  </div>
                ))}
              </div>

              {/* La planche A4 — largeur fixe écran 700px, ratio A4 préservé.
                  En impression, le CSS @media print bascule en mm réels. */}
              <div
                id="print-sheet"
                className="bg-white shadow-soft"
                style={{
                  width: "700px",
                  height: `${700 * (PAGE_H / PAGE_W)}px`,
                  padding: `${MARGIN * (700 / PAGE_W)}px`,
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                    gridTemplateRows: `repeat(${rows}, 1fr)`,
                    width: "100%",
                    height: "100%",
                    gap: "1mm",
                  }}
                >
                  {cells.map((qrId, i) => {
                    const qr = qrId ? qrById.get(qrId) : null;
                    const name = qr?.address?.client?.company_name ?? qr?.address?.client?.code ?? "";
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
                          // Clic sur case vide + QR actif → place. Clic sur
                          // case remplie → vide.
                          if (qrId) setCell(i, null);
                          else if (activeQrId) setCell(i, activeQrId);
                        }}
                        className={
                          "relative flex flex-col items-center justify-center text-center overflow-hidden cursor-pointer group " +
                          "border border-dashed " +
                          (qr ? "border-gray-300" : "border-gray-200 hover:border-primary/50 hover:bg-primary/5")
                        }
                        style={{ borderRadius: "2px", padding: "2px" }}
                      >
                        {qr ? (
                          <>
                            <div className="text-[7px] font-bold leading-tight line-clamp-2 px-0.5">
                              {name}
                            </div>
                            <QRCodeCanvas value={qr.code} size={qrPx} marginSize={0} />
                            <div className="text-[6px] font-mono leading-none break-all px-0.5">
                              {qr.code}
                            </div>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setCell(i, null); }}
                              className="no-print absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 bg-rose-500 text-white rounded-full p-0.5 transition-opacity"
                              title="Retirer"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </>
                        ) : (
                          <span className="no-print text-[9px] text-muted-foreground/40">{i + 1}</span>
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
    </div>
  );
}
