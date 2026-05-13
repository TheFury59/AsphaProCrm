import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Receipt, FileText, Briefcase, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useClientInvoices, useClientPrestations, useClientProfile, useClientQuotes } from "@/hooks/use-extranet";
import { api } from "@/lib/api";

/**
 * Page d'accueil client : vue restreinte de ses factures + devis + prestations.
 * Pas d'accès aux interventions de planning interne (info admin).
 */
export function ClientHome() {
  const { data: profile } = useClientProfile();
  const { data: invoices = [] } = useClientInvoices();
  const { data: quotes = [] } = useClientQuotes();
  const { data: prestations = [] } = useClientPrestations();

  const downloadFacturX = async (invoiceId: number) => {
    const res = await api.get(`/invoices/${invoiceId}/facturx`, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = `facture-${invoiceId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">
          Bonjour {profile?.company?.company_name ?? profile?.code ?? ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          Retrouvez vos documents et l'historique de nos prestations.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <StatCard label="Factures" value={invoices.length} icon={Receipt} />
        <StatCard label="Devis" value={quotes.length} icon={FileText} />
        <StatCard label="Prestations actives" value={prestations.filter((p: any) => !p.end_date).length} icon={Briefcase} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4" /> Mes factures</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((i: any) => (
                <TableRow key={i.id}>
                  <TableCell className="font-mono text-xs">{i.reference ?? `INV-${i.id}`}</TableCell>
                  <TableCell className="text-xs">{i.invoice_date && format(new Date(i.invoice_date), "dd/MM/yyyy", { locale: fr })}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{Number(i.total).toFixed(2)} €</TableCell>
                  <TableCell>
                    <Badge variant={i.payment_status === "paid" ? "default" : i.payment_status === "partial" ? "secondary" : "outline"}>
                      {i.payment_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => downloadFacturX(i.id)}>
                      <Download className="h-3 w-3 mr-1" /> PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {invoices.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Aucune facture.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Briefcase className="h-4 w-4" /> Mes prestations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prestation</TableHead>
                <TableHead>Tarif</TableHead>
                <TableHead>Démarrée le</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prestations.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell>{p.label ?? p.product?.name}</TableCell>
                  <TableCell className="text-sm">{Number(p.custom_price ?? p.base_price ?? 0).toFixed(2)} €</TableCell>
                  <TableCell className="text-xs">{p.start_date && format(new Date(p.start_date), "dd/MM/yyyy", { locale: fr })}</TableCell>
                  <TableCell>
                    {p.end_date ? <Badge variant="secondary">Terminée</Badge> : <Badge>Active</Badge>}
                  </TableCell>
                </TableRow>
              ))}
              {prestations.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">Aucune prestation.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  return (
    <Card>
      <CardContent className="pt-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-semibold leading-none">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
