import { Link } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { FileText, Receipt, Download, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

const PAYMENT_LABELS: Record<string, string> = {
  unpaid: "Non payée",
  partial: "Partielle",
  paid: "Payée",
};
const PAYMENT_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  partial: "secondary",
  unpaid: "outline",
};

/**
 * Onglet "Devis & factures" de la fiche client.
 * Liste les devis + factures du client + bouton download Factur-X.
 */
export function ClientSalesTab({ clientId }: { clientId: number }) {
  const { data: quotes, isLoading: qLoading } = useQuery({
    queryKey: ["client", clientId, "quotes"],
    queryFn: async () => {
      const { data } = await api.get(`/quotes?filter[client_id]=${clientId}&per_page=50`);
      return data.data as any[];
    },
  });
  const { data: invoices, isLoading: iLoading } = useQuery({
    queryKey: ["client", clientId, "invoices"],
    queryFn: async () => {
      const { data } = await api.get(`/invoices?filter[client_id]=${clientId}&per_page=50`);
      return data.data as any[];
    },
  });

  const downloadFacturX = async (invoiceId: number, reference: string) => {
    const res = await api.get(`/invoices/${invoiceId}/facturx`, { responseType: "blob" });
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reference ?? `INV-${invoiceId}`}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {/* === Devis === */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-orange-600" />
            Devis ({quotes?.length ?? 0})
          </CardTitle>
          <Link to="/devis">
            <Button variant="ghost" size="sm" className="text-xs">
              Module devis <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {qLoading && [...Array(2)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(4)].map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                </TableRow>
              ))}
              {!qLoading && (quotes ?? []).map((q: any) => (
                <TableRow key={q.id}>
                  <TableCell className="font-mono text-xs">{q.reference ?? `Q-${q.id}`}</TableCell>
                  <TableCell className="text-xs">{q.quote_date && format(new Date(q.quote_date), "dd/MM/yy", { locale: fr })}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{q.total ? `${Number(q.total).toFixed(2)} €` : "—"}</TableCell>
                  <TableCell><Badge variant="outline">{q.status}</Badge></TableCell>
                </TableRow>
              ))}
              {!qLoading && (quotes ?? []).length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">Aucun devis pour ce client.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* === Factures === */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4 text-emerald-600" />
            Factures ({invoices?.length ?? 0})
          </CardTitle>
          <Link to="/factures">
            <Button variant="ghost" size="sm" className="text-xs">
              Module factures <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Paiement</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {iLoading && [...Array(2)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(5)].map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                </TableRow>
              ))}
              {!iLoading && (invoices ?? []).map((inv: any) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-xs">{inv.reference ?? `INV-${inv.id}`}</TableCell>
                  <TableCell className="text-xs">{inv.invoice_date && format(new Date(inv.invoice_date), "dd/MM/yy", { locale: fr })}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{inv.total ? `${Number(inv.total).toFixed(2)} €` : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={PAYMENT_VARIANT[inv.payment_status] ?? "outline"}>
                      {PAYMENT_LABELS[inv.payment_status] ?? inv.payment_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => downloadFacturX(inv.id, inv.reference)}>
                      <Download className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!iLoading && (invoices ?? []).length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">Aucune facture pour ce client.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
