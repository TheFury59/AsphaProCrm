import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  useSalaryDeductions, useCreateSalaryDeduction, useDeleteSalaryDeduction,
} from "@/hooks/use-phase3";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export function SalaryDeductionsTab({ employeeId }: { employeeId: number }) {
  const { data: list = [] } = useSalaryDeductions(employeeId);
  const create = useCreateSalaryDeduction(employeeId);
  const del = useDeleteSalaryDeduction(employeeId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({
    creditor_name: "",
    case_number: "",
    address: "",
    payment_method: "transfer",
    comment: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync(form);
    setOpen(false);
    setForm({ creditor_name: "", case_number: "", address: "", payment_method: "transfer", comment: "" });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Saisies sur salaire</CardTitle>
          <CardDescription>Créanciers, dossiers, dettes et paiements</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Nouvelle saisie
        </Button>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune saisie en cours.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {list.map((d) => (
              <li key={d.id} className="flex items-start justify-between border rounded p-3">
                <div className="flex-1">
                  <div className="font-medium">{d.creditor_name}</div>
                  <div className="text-xs text-muted-foreground flex gap-2 mt-1 flex-wrap">
                    {d.case_number && <span>Dossier {d.case_number}</span>}
                    <Badge variant="outline" className="text-xs">{d.payment_method}</Badge>
                    <span>{d.salary_deduction_debts?.length ?? 0} dette(s)</span>
                    <span>{d.deduction_payments?.length ?? 0} paiement(s)</span>
                  </div>
                  {d.comment && <p className="text-xs mt-1 italic">{d.comment}</p>}
                </div>
                <button onClick={() => del.mutate(d.id)} className="text-destructive hover:bg-destructive/10 p-1 rounded">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle saisie sur salaire</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Créancier *</Label>
              <Input value={form.creditor_name} onChange={(e) => setForm((f: any) => ({ ...f, creditor_name: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>N° dossier</Label>
                <Input value={form.case_number} onChange={(e) => setForm((f: any) => ({ ...f, case_number: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Mode paiement</Label>
                <select value={form.payment_method} onChange={(e) => setForm((f: any) => ({ ...f, payment_method: e.target.value }))}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9">
                  <option value="transfer">Virement</option>
                  <option value="check">Chèque</option>
                  <option value="cash">Espèces</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Adresse</Label>
              <Textarea rows={2} value={form.address} onChange={(e) => setForm((f: any) => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Commentaire</Label>
              <Textarea rows={2} value={form.comment} onChange={(e) => setForm((f: any) => ({ ...f, comment: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={create.isPending}>Enregistrer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
