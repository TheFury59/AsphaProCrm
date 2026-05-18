import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { useClients } from "@/hooks/use-clients";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CreateClientDialog } from "./CreateClientDialog";
import { EntityAvatar } from "@/components/EntityAvatar";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  inactive: "secondary",
  suspended: "destructive",
};

export function ClientsListPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useClients({ page, per_page: 25, search });

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Entreprises clientes d'Aspha — gestion et suivi commercial."
        actions={
          <Button onClick={() => setCreateOpen(true)} className="bg-gradient-aspha shadow-brand text-white border-0 hover:opacity-95">
            <Plus className="h-4 w-4 mr-1.5" /> Nouveau client
          </Button>
        }
      />

      {/* Barre de recherche en card */}
      <div className="mb-5 px-4 py-3 rounded-2xl bg-card shadow-soft flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, SIRET, code, email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 border-0 bg-muted/40 focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
        {data && (
          <div className="text-xs text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-md">
            <span className="font-medium text-foreground">{data.meta.total}</span> client{data.meta.total > 1 ? "s" : ""}
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-card shadow-soft overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b">
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Code</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Entreprise</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold">SIRET</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Email</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Téléphone</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Statut</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && [...Array(5)].map((_, i) => (
              <TableRow key={`s-${i}`}>
                {[...Array(7)].map((_, j) => (
                  <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                ))}
              </TableRow>
            ))}
            {data?.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-12">
                  <div className="space-y-2">
                    <div>Aucun client.</div>
                    <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                      <Plus className="h-3 w-3 mr-1" /> Créer le premier
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {data?.data.map((c) => (
              <TableRow key={c.id} className="hover:bg-muted/30 transition-colors">
                <TableCell className="font-mono text-xs">{c.code}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <EntityAvatar
                      src={c.company?.logo_url}
                      name={c.company?.company_name ?? c.display_name}
                      variant="client"
                      size="sm"
                    />
                    <span className="font-medium">{c.company?.company_name ?? c.display_name}</span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{c.company?.siret ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.company?.primary_email ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.company?.phone_landline ?? c.company?.phone_mobile ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[c.status]}>{c.status}</Badge>
                </TableCell>
                <TableCell>
                  <Link to={`/clients/${c.id}`} className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1 group">
                    Ouvrir
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data && data.meta.last_page > 1 && (
        <div className="flex items-center justify-between mt-4 px-4 py-3 rounded-xl bg-card shadow-soft text-sm">
          <span className="text-muted-foreground">
            Page <span className="font-medium text-foreground">{data.meta.current_page}</span> sur {data.meta.last_page}
          </span>
          <div className="space-x-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Précédent</Button>
            <Button variant="outline" size="sm" disabled={page >= data.meta.last_page} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
          </div>
        </div>
      )}

      <CreateClientDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
