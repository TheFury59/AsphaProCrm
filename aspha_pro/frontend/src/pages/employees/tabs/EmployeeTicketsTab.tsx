import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Ticket as TicketIcon, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EntityAvatar } from "@/components/EntityAvatar";
import { Button } from "@/components/ui/button";
import { useEmployeeTickets } from "@/hooks/use-tickets";

/**
 * Onglet "Tickets" de la fiche intervenant (admin).
 * Liste les tickets où cet intervenant est affecté OU qu'il a créés.
 * Chaque ligne deep-link vers la page détail du ticket.
 */

const TYPE_LABEL = (t: string): string => ({
  complaint: "Réclamation",
  problem_report: "Signalement",
  consumable_reorder: "Commande conso.",
} as Record<string, string>)[t] ?? t;

const STATUS_LABEL = (s: string): string => ({
  open: "Ouvert",
  in_progress: "En cours",
  resolved: "Résolu",
  closed: "Fermé",
} as Record<string, string>)[s] ?? s;

export function EmployeeTicketsTab({ employeeId }: { employeeId: number }) {
  const { data: tickets, isLoading } = useEmployeeTickets(employeeId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TicketIcon className="h-4 w-4" /> Tickets ({tickets?.length ?? 0})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Sujet</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Créé</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(tickets?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                    <TicketIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    Cet intervenant n'est affecté à aucun ticket.
                  </TableCell>
                </TableRow>
              )}
              {tickets?.map((t) => {
                const companyName = t.client?.company?.company_name ?? `Client #${t.client_id}`;
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <EntityAvatar
                          src={t.client?.company?.logo_url}
                          name={companyName}
                          variant="client"
                          size="xs"
                        />
                        <span className="text-sm">{companyName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{TYPE_LABEL(t.type)}</TableCell>
                    <TableCell className="text-sm font-medium truncate max-w-[240px]">
                      {t.subject ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.status === "resolved" || t.status === "closed" ? "secondary" : "default"}>
                        {STATUS_LABEL(t.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(t.created_at), { locale: fr, addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/tickets/${t.id}`}>
                          Ouvrir <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
