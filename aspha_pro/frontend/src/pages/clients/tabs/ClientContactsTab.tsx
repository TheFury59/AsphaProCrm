import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useClientContacts, useCreateClientContact, useDeleteClientContact,
} from "@/hooks/use-sub-resources";
import { apiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export function ClientContactsTab({ clientId }: { clientId: number }) {
  return (
    <div>
      <ContactsCard clientId={clientId} />
    </div>
  );
}

function ContactsCard({ clientId }: { clientId: number }) {
  const { data: contacts = [] } = useClientContacts(clientId);
  const create = useCreateClientContact(clientId);
  const del = useDeleteClientContact(clientId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"phone" | "email" | "mobile">("phone");
  const [value, setValue] = useState("");
  const [primary, setPrimary] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validation métier au clic (pas de submit disabled).
    if (!name.trim()) {
      toast.error("Le nom du contact est requis.");
      return;
    }
    if (!value.trim()) {
      toast.error("La valeur du contact est requise.");
      return;
    }
    try {
      await create.mutateAsync({ name: name.trim(), type, value: value.trim(), is_primary: primary });
      setOpen(false); setName(""); setValue(""); setPrimary(false);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Échec de l'ajout du contact"));
      console.error("Création contact entreprise échouée", e);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Contacts entreprise</CardTitle>
          <CardDescription>Noms, téléphones et emails</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
        </Button>
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun contact.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {contacts.map((c) => (
              <li key={c.id} className="flex items-center justify-between border-b py-1.5">
                <span className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{c.type}</Badge>
                  {c.name && <span className="font-medium">{c.name}</span>}
                  <span className="text-muted-foreground">{c.value}</span>
                  {c.is_primary && <Badge>Prioritaire</Badge>}
                </span>
                <button onClick={() => del.mutate(c.id)} className="text-destructive hover:bg-destructive/10 p-1 rounded">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajouter un contact</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nom *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Marie Dupont, Standard…" />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <select value={type} onChange={(e) => setType(e.target.value as any)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9">
                <option value="phone">Téléphone</option>
                <option value="email">Email</option>
                <option value="mobile">Mobile</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Valeur</Label>
              <Input value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={primary} onChange={(e) => setPrimary(e.target.checked)} />
              Marquer comme prioritaire
            </label>
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
