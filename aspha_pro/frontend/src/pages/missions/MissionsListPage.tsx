import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Briefcase, Search, Package, FileText, ChevronRight, Plus, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useClients } from "@/hooks/use-clients";
import { useAllMissions, type MissionStatus } from "@/hooks/use-missions";

/**
 * Page menu "Missions" — vue cross-clients de toutes les missions.
 *
 * Création : pas de bouton "Nouvelle mission" ici car une mission est
 * toujours rattachée à un client. On passe par la fiche client →
 * Missions → Nouvelle mission (route /clients/:id/missions/new).
 */

const STATUS_COLORS: Record<MissionStatus, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  suspended: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

const STATUS_LABELS: Record<MissionStatus, string> = {
  active: "Active",
  suspended: "Suspendue",
  cancelled: "Annulée",
};

export function MissionsListPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<MissionStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data, isLoading } = useAllMissions({
    page,
    per_page: 25,
    search,
    status: status === "all" ? undefined : status,
  });

  const rows = data?.data ?? [];
  const total = data?.meta.total ?? 0;

  return (
    <div>
      <PageHeader
        title="Missions"
        description="Vue cross-clients de tous les contrats de service en cours."
        actions={
          <Button
            onClick={() => setPickerOpen(true)}
            className="bg-gradient-aspha shadow-brand text-white border-0 hover:opacity-95"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Nouvelle mission
          </Button>
        }
      />

      <ClientPickerDialog open={pickerOpen} onClose={() => setPickerOpen(false)} />

      {/* Filtres */}
      <div className="mb-5 px-4 py-3 rounded-2xl bg-card shadow-soft flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Nom de mission, raison sociale client…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 border-0 bg-muted/40 focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>

        <Select value={status} onValueChange={(v) => { setStatus(v as any); setPage(1); }}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="active">Actives</SelectItem>
            <SelectItem value="suspended">Suspendues</SelectItem>
            <SelectItem value="cancelled">Annulées</SelectItem>
          </SelectContent>
        </Select>

        <div className="text-xs text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-md ml-auto">
          <span className="font-medium text-foreground">{total}</span> mission{total > 1 ? "s" : ""}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-card shadow-soft overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b">
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Mission</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Client</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Prestations</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Rythme</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Devis</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Statut</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && [...Array(6)].map((_, i) => (
              <TableRow key={`s-${i}`}>
                {[...Array(7)].map((_, j) => (
                  <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                ))}
              </TableRow>
            ))}

            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <Briefcase className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <div className="text-sm text-muted-foreground">
                    Aucune mission trouvée.
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Crée une mission depuis la fiche d'un client.
                  </div>
                </TableCell>
              </TableRow>
            )}

            {rows.map((m: any) => {
              const prestationsCount = m.client_prestations_count ?? m.client_prestations?.length ?? 0;
              const companyName = m.client?.company?.company_name ?? `Client #${m.client_id}`;
              return (
                <TableRow key={m.id} className="group">
                  <TableCell>
                    <div className="font-medium text-sm">{m.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">#{m.id}</div>
                  </TableCell>
                  <TableCell>
                    <Link
                      to={`/clients/${m.client_id}`}
                      className="text-sm hover:text-primary transition-colors"
                    >
                      {companyName}
                    </Link>
                    {m.client?.code && (
                      <div className="text-[10px] text-muted-foreground font-mono">{m.client.code}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Package className="h-3 w-3 text-muted-foreground" />
                      <span className="tabular-nums">{prestationsCount}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {m.billing_rhythm ?? "—"}
                  </TableCell>
                  <TableCell>
                    {m.quote?.reference ? (
                      <Badge variant="outline" className="gap-1 text-[10px] h-5 font-mono">
                        <FileText className="h-2.5 w-2.5" />
                        {m.quote.reference}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[m.status as MissionStatus] ?? ""}>
                      {STATUS_LABELS[m.status as MissionStatus] ?? m.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link to={`/clients/${m.client_id}#missions`}>
                      <Button size="icon" variant="ghost" className="h-7 w-7 opacity-60 group-hover:opacity-100">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.meta.last_page > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {data.meta.current_page} / {data.meta.last_page}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Précédent
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= data.meta.last_page}
              onClick={() => setPage((p) => p + 1)}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Picker minimal pour choisir le client avant d'ouvrir CreateMissionPage.
 * Une mission est toujours rattachée à un client (FK client_id), donc on doit
 * sélectionner ce client AVANT d'arriver sur le formulaire de création.
 */
function ClientPickerDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  // `useClients` fait déjà le filtre serveur sur search ; on délègue au backend
  // plutôt que de paginer 25 clients en local — un grand fichier peut avoir 1000+ clients.
  const { data, isLoading } = useClients({ per_page: 25, search: q, status: "active" });

  const clients = useMemo(() => data?.data ?? [], [data]);

  const pick = (clientId: number) => {
    onClose();
    setQ("");
    navigate(`/clients/${clientId}/missions/new`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setQ(""); } }}>
      <DialogContent className="sm:!max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            Nouvelle mission — Choisir le client
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Nom, code, SIRET, email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          <div className="max-h-72 overflow-y-auto rounded-lg border divide-y">
            {isLoading && (
              <div className="p-4 text-xs text-muted-foreground italic">Recherche…</div>
            )}
            {!isLoading && clients.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Aucun client trouvé.
              </div>
            )}
            {clients.map((c: any) => (
              <button
                key={c.id}
                type="button"
                onClick={() => pick(c.id)}
                className="w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors flex items-center gap-2 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {c.company?.company_name ?? c.display_name ?? c.code}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">{c.code}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground">
            Une mission est toujours rattachée à un client. Choisis-le pour continuer.
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => { onClose(); setQ(""); }}>
            Annuler
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
