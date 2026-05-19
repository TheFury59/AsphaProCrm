import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { useEmployees } from "@/hooks/use-employees";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CreateEmployeeDialog } from "./CreateEmployeeDialog";
import { EntityAvatar } from "@/components/EntityAvatar";
import { ClickableRow } from "@/components/ClickableRow";

export function EmployeesListPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useEmployees({ page, per_page: 25, search });

  return (
    <div>
      <PageHeader
        title="Intervenants"
        description="Salariés Aspha — contrats, compétences, planning."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nouvel intervenant
          </Button>
        }
      />

      <div className="mb-4 relative max-w-sm">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom, téléphone…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-9"
        />
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Classification</TableHead>
              <TableHead>Mode de déplacement</TableHead>
              <TableHead>Véhicule service</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && [...Array(5)].map((_, i) => (
              <TableRow key={`s-${i}`}>
                {[...Array(6)].map((_, j) => (
                  <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                ))}
              </TableRow>
            ))}
            {data?.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  Aucun intervenant. Crée le premier avec « Nouvel intervenant ».
                </TableCell>
              </TableRow>
            )}
            {data?.data.map((e) => (
              <ClickableRow key={e.id} to={`/intervenants/${e.id}`}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <EntityAvatar src={e.avatar_url} name={e.full_name} variant="employee" size="sm" />
                    <span className="font-medium">{e.full_name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{e.phone ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={e.classification === "cadre" ? "default" : "secondary"}>
                    {e.classification === "cadre" ? "Cadre" : "Non-cadre"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{e.transport_mode ?? "—"}</TableCell>
                <TableCell>
                  {e.has_company_vehicle ? <Badge>Oui</Badge> : <span className="text-muted-foreground text-sm">Non</span>}
                </TableCell>
                <TableCell>
                  <Link to={`/intervenants/${e.id}`} className="text-sm font-medium text-primary hover:underline">
                    Ouvrir
                  </Link>
                </TableCell>
              </ClickableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data && data.meta.last_page > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <span>{data.meta.total} intervenant{data.meta.total > 1 ? "s" : ""} · page {data.meta.current_page} / {data.meta.last_page}</span>
          <div className="space-x-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Précédent</Button>
            <Button variant="outline" size="sm" disabled={page >= data.meta.last_page} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
          </div>
        </div>
      )}

      <CreateEmployeeDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
