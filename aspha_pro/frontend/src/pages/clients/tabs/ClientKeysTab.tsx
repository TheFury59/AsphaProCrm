import { useState } from "react";
import { Plus, Trash2, History } from "lucide-react";
import {
  useClientKeys, useCreateClientKey, useDeleteClientKey,
  useKeyMovements, useCreateKeyMovement,
} from "@/hooks/use-sub-resources";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export function ClientKeysTab({ clientId }: { clientId: number }) {
  const { data: list = [] } = useClientKeys(clientId);
  const create = useCreateClientKey(clientId);
  const del = useDeleteClientKey(clientId);
  const [addOpen, setAddOpen] = useState(false);
  const [keyForm, setKeyForm] = useState({ label: "", current_holder: "" });
  const [historyKeyId, setHistoryKeyId] = useState<number | null>(null);

  const addKey = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync(keyForm);
    setAddOpen(false);
    setKeyForm({ label: "", current_holder: "" });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Clés</CardTitle>
          <CardDescription>Suivi des clés détenues + historique mouvements</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Nouvelle clé
        </Button>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune clé enregistrée.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {list.map((k) => (
              <li key={k.id} className="flex items-center justify-between border rounded p-2">
                <div>
                  <div className="font-medium">{k.label}</div>
                  <div className="text-xs text-muted-foreground">
                    Détenteur actuel : <Badge variant="outline" className="ml-1 text-xs">{k.current_holder ?? "—"}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setHistoryKeyId(k.id)}>
                    <History className="h-3.5 w-3.5 mr-1" /> Historique
                  </Button>
                  <button onClick={() => del.mutate(k.id)} className="text-destructive hover:bg-destructive/10 p-2 rounded">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle clé</DialogTitle></DialogHeader>
          <form onSubmit={addKey} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Libellé</Label>
              <Input value={keyForm.label} onChange={(e) => setKeyForm((f) => ({ ...f, label: e.target.value }))} required placeholder="Ex. Clé entrée principale" />
            </div>
            <div className="space-y-1.5">
              <Label>Détenteur initial</Label>
              <Input value={keyForm.current_holder} onChange={(e) => setKeyForm((f) => ({ ...f, current_holder: e.target.value }))} placeholder="Ex. Coffre agence, intervenant…" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={create.isPending}>Ajouter</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {historyKeyId && (
        <KeyHistoryDialog clientId={clientId} keyId={historyKeyId} onClose={() => setHistoryKeyId(null)} />
      )}
    </Card>
  );
}

function KeyHistoryDialog({ clientId, keyId, onClose }: { clientId: number; keyId: number; onClose: () => void }) {
  const { data: movements = [] } = useKeyMovements(clientId, keyId);
  const create = useCreateKeyMovement(clientId, keyId);
  const [form, setForm] = useState({
    from_holder: "",
    to_holder: "",
    date: new Date().toISOString().slice(0, 16),
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync({ ...form, date: form.date });
    setForm((f) => ({ ...f, from_holder: form.to_holder, to_holder: "" }));
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Historique des mouvements</DialogTitle></DialogHeader>

        <div className="max-h-64 overflow-y-auto space-y-1.5 text-sm border rounded p-2">
          {movements.length === 0 ? (
            <p className="text-muted-foreground">Aucun mouvement encore.</p>
          ) : movements.map((m) => (
            <div key={m.id} className="border-b last:border-0 py-1.5">
              <div className="text-xs text-muted-foreground">{new Date(m.date).toLocaleString("fr-FR")}</div>
              <div>
                <span className="text-muted-foreground">{m.from_holder ?? "—"}</span>
                <span className="mx-2">→</span>
                <span className="font-medium">{m.to_holder}</span>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3 pt-3 border-t">
          <h4 className="text-sm font-medium">Enregistrer un mouvement</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">De</Label>
              <Input size={1} value={form.from_holder} onChange={(e) => setForm((f) => ({ ...f, from_holder: e.target.value }))} placeholder="Détenteur précédent" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vers</Label>
              <Input size={1} value={form.to_holder} onChange={(e) => setForm((f) => ({ ...f, to_holder: e.target.value }))} required placeholder="Nouveau détenteur" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Date</Label>
            <Input type="datetime-local" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Fermer</Button>
            <Button type="submit" size="sm" disabled={create.isPending}>Enregistrer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
