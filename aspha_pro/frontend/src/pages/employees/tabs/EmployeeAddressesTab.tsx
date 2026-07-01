import { useState } from "react";
import { Plus, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";
import {
  useEmployeeAddresses, useCreateEmployeeAddress, useDeleteEmployeeAddress,
} from "@/hooks/use-sub-resources";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { confirm } from "@/components/ui/confirm";

/**
 * Adresse(s) de l'intervenant — surtout son domicile.
 * L'adresse est géocodée automatiquement (BAN) à l'enregistrement ; ses
 * coordonnées alimentent la carte de suggestion d'intervenants (proximité
 * au client). Sans adresse géocodée, l'intervenant n'apparaît pas sur la
 * carte. 2026-05-21.
 */
export function EmployeeAddressesTab({ employeeId }: { employeeId: number }) {
  const { data: list = [] } = useEmployeeAddresses(employeeId);
  const create = useCreateEmployeeAddress(employeeId);
  const del = useDeleteEmployeeAddress(employeeId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ address: "", postal_code: "", city: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.address.trim() || !form.postal_code.trim() || !form.city.trim()) {
      toast.error("Renseigne l'adresse, le code postal et la ville.");
      return;
    }
    try {
      await create.mutateAsync({ type: "main", ...form });
      toast.success("Adresse ajoutée. Géocodage en cours…");
      setOpen(false);
      setForm({ address: "", postal_code: "", city: "" });
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Échec de l'enregistrement.");
    }
  };

  const remove = async (id: number) => {
    if (!(await confirm({ title: "Supprimer l'adresse", description: "Supprimer cette adresse ?", confirmLabel: "Supprimer", variant: "danger" }))) return;
    try {
      await del.mutateAsync(id);
      toast.success("Adresse supprimée.");
    } catch {
      toast.error("Échec de la suppression.");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Adresse</CardTitle>
          <CardDescription>
            Domicile de l'intervenant — géocodé pour la carte de suggestion (proximité client).
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Ajouter une adresse
        </Button>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Aucune adresse. Ajoute le domicile de l'intervenant pour qu'il apparaisse sur la carte.
          </p>
        ) : (
          <ul className="space-y-2">
            {list.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="text-sm">
                    <div className="font-medium">{a.address}</div>
                    <div className="text-muted-foreground">{a.postal_code} {a.city}</div>
                    {a.latitude != null && a.longitude != null ? (
                      <Badge variant="secondary" className="text-[10px] mt-1">Géocodée ✓</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] mt-1">Non géocodée</Badge>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => remove(a.id)}
                  className="text-destructive hover:bg-destructive/10 p-2 rounded shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajouter une adresse</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Adresse *</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="12 rue des Lilas"
              />
            </div>
            <div className="grid grid-cols-[120px_1fr] gap-3">
              <div className="space-y-1.5">
                <Label>Code postal *</Label>
                <Input
                  value={form.postal_code}
                  onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))}
                  placeholder="59000"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ville *</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="Lille"
                />
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
