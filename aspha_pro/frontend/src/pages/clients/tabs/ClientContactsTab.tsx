import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  useClientContacts, useCreateClientContact, useDeleteClientContact,
  useClientRelatedContacts, useCreateClientRelated, useDeleteClientRelated,
} from "@/hooks/use-sub-resources";
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
    <div className="grid md:grid-cols-2 gap-4">
      <ContactsCard clientId={clientId} />
      <RelatedCard clientId={clientId} />
    </div>
  );
}

function ContactsCard({ clientId }: { clientId: number }) {
  const { data: contacts = [] } = useClientContacts(clientId);
  const create = useCreateClientContact(clientId);
  const del = useDeleteClientContact(clientId);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"phone" | "email" | "mobile">("phone");
  const [value, setValue] = useState("");
  const [primary, setPrimary] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync({ type, value, is_primary: primary });
    setOpen(false); setValue(""); setPrimary(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Contacts entreprise</CardTitle>
          <CardDescription>Téléphones et emails</CardDescription>
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
                  <span>{c.value}</span>
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
              <Input value={value} onChange={(e) => setValue(e.target.value)} required />
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

function RelatedCard({ clientId }: { clientId: number }) {
  const { data: list = [] } = useClientRelatedContacts(clientId);
  const create = useCreateClientRelated(clientId);
  const del = useDeleteClientRelated(clientId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ type: "family" | "doctor" | "emergency"; name: string; phone: string }>({
    type: "family", name: "", phone: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync(form);
    setOpen(false); setForm({ type: "family", name: "", phone: "" });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Contacts liés</CardTitle>
          <CardDescription>Famille, médecin, urgence</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
        </Button>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun contact lié.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {list.map((c) => (
              <li key={c.id} className="flex items-center justify-between border-b py-1.5">
                <span>
                  <Badge variant="outline" className="text-xs mr-2">{c.type}</Badge>
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground ml-2">{c.phone}</span>
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
          <DialogHeader><DialogTitle>Ajouter un contact lié</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as any }))}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9">
                <option value="family">Famille</option>
                <option value="doctor">Médecin</option>
                <option value="emergency">Urgence</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Téléphone</Label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} required />
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
