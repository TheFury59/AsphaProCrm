import { useState } from "react";
import { Plus } from "lucide-react";
import { useQuotes, useCreateQuote } from "@/hooks/use-phase3";
import { useClients } from "@/hooks/use-clients";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  sent: "outline",
  accepted: "default",
  refused: "destructive",
  expired: "secondary",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon", sent: "Envoyé", accepted: "Accepté", refused: "Refusé", expired: "Expiré",
};

export function QuotesListPage() {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuotes({ page, per_page: 25 });

  return (
    <div>
      <PageHeader
        title="Devis"
        description="Propositions commerciales — synchro Pennylane à venir"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nouveau devis
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Validité</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Réussite</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(5)].map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                </TableRow>
              ))}
              {(data as any)?.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                    Aucun devis. Crée le premier avec « Nouveau devis ».
                  </TableCell>
                </TableRow>
              )}
              {(data as any)?.data?.map((q: any) => (
                <TableRow key={q.id}>
                  <TableCell className="font-medium">{q.client?.client_companies?.[0]?.company_name ?? `Client #${q.client_id}`}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{q.quote_date}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{q.validity_date ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[q.status]}>{STATUS_LABELS[q.status] ?? q.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{q.success_rate ? `${q.success_rate}%` : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(data as any)?.meta?.last_page > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <span>{(data as any).meta.total} devis · page {(data as any).meta.current_page} / {(data as any).meta.last_page}</span>
          <div className="space-x-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Précédent</Button>
            <Button variant="outline" size="sm" disabled={page >= (data as any).meta.last_page} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
          </div>
        </div>
      )}

      <CreateQuoteDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function CreateQuoteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateQuote();
  const { data: clientsData } = useClients({ per_page: 100 });
  const [form, setForm] = useState({
    client_id: "",
    entity_id: "1",
    quote_date: new Date().toISOString().slice(0, 10),
    validity_date: "",
    nature: "regular",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync({
      client_id: parseInt(form.client_id, 10) as any,
      entity_id: parseInt(form.entity_id, 10) as any,
      quote_date: form.quote_date,
      validity_date: form.validity_date || null,
      nature: form.nature as any,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouveau devis</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Client *</Label>
            <select value={form.client_id} onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9" required>
              <option value="">— Choisir —</option>
              {clientsData?.data?.map((c: any) => <option key={c.id} value={c.id}>{c.company?.company_name ?? c.code}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date du devis *</Label>
              <Input type="date" value={form.quote_date} onChange={(e) => setForm((f) => ({ ...f, quote_date: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Validité</Label>
              <Input type="date" value={form.validity_date} onChange={(e) => setForm((f) => ({ ...f, validity_date: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Nature</Label>
            <select value={form.nature} onChange={(e) => setForm((f) => ({ ...f, nature: e.target.value }))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9">
              <option value="regular">Régulière</option>
              <option value="punctual">Ponctuelle</option>
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={create.isPending}>Créer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
