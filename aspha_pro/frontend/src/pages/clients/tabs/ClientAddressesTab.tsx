import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  useClientAddresses, useCreateClientAddress, useDeleteClientAddress,
} from "@/hooks/use-sub-resources";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const TYPE_LABELS: Record<string, string> = {
  main: "Principale",
  billing: "Facturation",
  intervention: "Intervention",
  other: "Autre",
};

export function ClientAddressesTab({ clientId }: { clientId: number }) {
  const { data: list = [] } = useClientAddresses(clientId);
  const create = useCreateClientAddress(clientId);
  const del = useDeleteClientAddress(clientId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    type: "main" as "main" | "billing" | "intervention" | "other",
    address: "",
    city: "",
    postal_code: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync(form);
    setOpen(false);
    setForm({ type: "main", address: "", city: "", postal_code: "" });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Adresses</CardTitle>
          <CardDescription>Siège, facturation, intervention…</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
        </Button>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune adresse renseignée.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {list.map((a) => (
              <li key={a.id} className="flex items-start justify-between border rounded p-2">
                <div>
                  <Badge variant="outline" className="mb-1 text-xs">{TYPE_LABELS[a.type] ?? a.type}</Badge>
                  <div>{a.address}</div>
                  <div className="text-muted-foreground">{a.postal_code} {a.city}</div>
                </div>
                <button onClick={() => del.mutate(a.id)} className="text-destructive hover:bg-destructive/10 p-1 rounded">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle adresse</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as any }))}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9">
                <option value="main">Principale</option>
                <option value="billing">Facturation</option>
                <option value="intervention">Intervention</option>
                <option value="other">Autre</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Adresse</Label>
              <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-[1fr_2fr] gap-3">
              <div className="space-y-1.5">
                <Label>Code postal</Label>
                <Input value={form.postal_code} onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Ville</Label>
                <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} required />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={create.isPending}>Ajouter</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
