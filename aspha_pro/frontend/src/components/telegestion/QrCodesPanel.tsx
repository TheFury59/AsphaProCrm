import { useMemo, useState } from "react";
import { Plus, QrCode as QrIcon, Search } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQrCodes, type QrCode } from "@/hooks/use-operations";
import { QrGenerationDialog } from "./QrGenerationDialog";
import { QrDisplayDialog } from "./QrDisplayDialog";

type QrCodesPanelProps = {
  /**
   * Si fourni, la liste est filtrée serveur (?client_id=) et le bouton
   * de génération pré-sélectionne ce client (lockedClientId).
   */
  clientId?: number | null;
  /** Titre custom (par ex. « QR codes de ce client »). */
  title?: string;
};

/**
 * Panneau réutilisable QR codes — utilisé par la page Télégestion globale et
 * par l'onglet Télégestion de la fiche client.
 */
export function QrCodesPanel({ clientId = null, title = "QR codes actifs" }: QrCodesPanelProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [viewing, setViewing] = useState<QrCode | null>(null);

  const { data, isLoading } = useQrCodes({
    client_id: clientId ?? undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((qr) => {
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
  }, [data, search]);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-base">{title}</CardTitle>
          <Button size="sm" type="button" onClick={() => setOpenCreate(true)}>
            <Plus className="mr-2 h-3 w-3" />
            Générer
          </Button>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Filtres */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Recherche client, adresse, code…"
                className="pl-7 h-8 text-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-[160px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="valid">Valides</SelectItem>
                <SelectItem value="obsolete">Révoqués</SelectItem>
                <SelectItem value="invalid">Invalides</SelectItem>
                <SelectItem value="to_validate">À valider</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tableau */}
          <div className="rounded-md border">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {!clientId && <TableHead>Client</TableHead>}
                    <TableHead>Adresse</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Expire</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((qr) => (
                    <TableRow key={qr.id}>
                      {!clientId && (
                        <TableCell>
                          {qr.address?.client ? (
                            <div className="min-w-0">
                              <div className="truncate text-sm">
                                {qr.address.client.company_name ?? qr.address.client.code ?? "—"}
                              </div>
                              {qr.address.client.company_name && qr.address.client.code && (
                                <div className="truncate text-xs text-muted-foreground">
                                  {qr.address.client.code}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        {qr.address ? (
                          <div className="min-w-0">
                            <div className="truncate text-sm">
                              {qr.address.address ?? "—"}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {qr.address.postal_code} {qr.address.city}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{qr.code}</TableCell>
                      <TableCell>
                        <Badge
                          variant={qr.status === "valid" ? "default" : "secondary"}
                        >
                          {qr.status === "valid"
                            ? "Valide"
                            : qr.status === "obsolete"
                            ? "Révoqué"
                            : qr.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {qr.expires_at
                          ? format(new Date(qr.expires_at), "dd/MM/yy HH:mm", { locale: fr })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => setViewing(qr)}
                        >
                          <QrIcon className="mr-1 h-3 w-3" />
                          Voir le QR
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={clientId ? 5 : 6}
                        className="text-center text-sm text-muted-foreground py-8"
                      >
                        Aucun QR code.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      <QrGenerationDialog
        open={openCreate}
        onOpenChange={setOpenCreate}
        lockedClientId={clientId}
      />
      <QrDisplayDialog
        qr={viewing}
        open={!!viewing}
        onOpenChange={(o) => !o && setViewing(null)}
      />
    </>
  );
}
