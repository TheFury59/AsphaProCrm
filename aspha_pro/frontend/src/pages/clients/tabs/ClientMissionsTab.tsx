import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Briefcase, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

/**
 * Onglet "Missions & prestations" de la fiche client.
 * Liste les client_prestations (contrats de prestation) du client.
 */
export function ClientMissionsTab({ clientId }: { clientId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["client", clientId, "prestations"],
    queryFn: async () => {
      const { data } = await api.get(`/clients/${clientId}`);
      return (data.data?.prestations ?? []) as any[];
    },
  });

  // Fallback : si la fiche détaillée n'embarque pas les prestations, on tape direct
  // l'extranet endpoint qui les retourne (réutilisé du portail client).
  const { data: fallback } = useQuery({
    queryKey: ["client", clientId, "prestations-fallback"],
    enabled: !data || data.length === 0,
    queryFn: async () => {
      try {
        const { data } = await api.get(`/extranet/client/prestations`);
        return data.data as any[];
      } catch {
        return [];
      }
    },
  });

  const prestations = (data?.length ? data : fallback) ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary" />
          Prestations du client ({prestations.length})
        </CardTitle>
        <Link to="/prestations">
          <Button variant="ghost" size="sm" className="text-xs">
            Catalogue <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prestation</TableHead>
              <TableHead>Tarif</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Du</TableHead>
              <TableHead>Au</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && [...Array(3)].map((_, i) => (
              <TableRow key={i}>
                {[...Array(6)].map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
              </TableRow>
            ))}
            {!isLoading && prestations.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  Aucune prestation enregistrée pour ce client.
                </TableCell>
              </TableRow>
            )}
            {prestations.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="text-sm font-medium">{p.label ?? p.product?.name ?? "—"}</div>
                  {p.product?.code && (
                    <div className="text-[10px] text-muted-foreground font-mono">{p.product.code}</div>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {Number(p.custom_price ?? p.base_price ?? 0).toFixed(2)} €
                </TableCell>
                <TableCell><Badge variant="outline">{p.pricing_type ?? "—"}</Badge></TableCell>
                <TableCell className="text-xs">{p.start_date && format(new Date(p.start_date), "dd/MM/yy", { locale: fr })}</TableCell>
                <TableCell className="text-xs">
                  {p.end_date ? format(new Date(p.end_date), "dd/MM/yy", { locale: fr }) : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  {p.end_date ? <Badge variant="secondary">Terminée</Badge> : <Badge>Active</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
