import { useRef, useState } from "react";
import { Download, Plus, Trash2, FileText } from "lucide-react";
import { useDocuments, useUploadDocument, useDeleteDocument } from "@/hooks/use-sub-resources";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const DOC_TYPE_LABELS: Record<string, string> = {
  contract: "Contrat",
  invoice: "Facture",
  insurance: "Assurance",
  product_sheet: "Fiche produit",
  protocol: "Protocole",
  other: "Autre",
};

type Props = {
  ownerType: "client" | "employee" | "contract" | "invoice" | "quote";
  ownerId: number;
};

export function DocumentsTab({ ownerType, ownerId }: Props) {
  const { data: list = [] } = useDocuments(ownerType, ownerId);
  const upload = useUploadDocument(ownerType, ownerId);
  const del = useDeleteDocument(ownerType, ownerId);
  const [open, setOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    label: "",
    document_type: "other" as keyof typeof DOC_TYPE_LABELS,
    is_client_visible: false,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileInput.current?.files?.[0];
    if (!file) return;
    await upload.mutateAsync({ ...form, file });
    setOpen(false);
    setForm({ label: "", document_type: "other", is_client_visible: false });
    if (fileInput.current) fileInput.current.value = "";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Documents</CardTitle>
          <CardDescription>Contrats, attestations, fiches techniques…</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Téléverser
        </Button>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun document.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {list.map((d) => (
              <li key={d.id} className="flex items-center justify-between border rounded p-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{d.label}</div>
                    <div className="text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs mr-2">{DOC_TYPE_LABELS[d.document_type] ?? d.document_type}</Badge>
                      {d.size_kb ? `${d.size_kb} ko` : ""}
                      {d.is_client_visible && <Badge className="ml-2 text-xs">Visible client</Badge>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <a href={d.download_url} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="ghost"><Download className="h-3.5 w-3.5" /></Button>
                  </a>
                  <button onClick={() => del.mutate(d.id)} className="text-destructive hover:bg-destructive/10 p-2 rounded">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Téléverser un document</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Libellé</Label>
              <Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <select value={form.document_type} onChange={(e) => setForm((f) => ({ ...f, document_type: e.target.value as any }))}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9">
                {Object.entries(DOC_TYPE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Fichier (max 10 Mo)</Label>
              <Input type="file" ref={fileInput} required />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_client_visible} onChange={(e) => setForm((f) => ({ ...f, is_client_visible: e.target.checked }))} />
              Visible dans le portail client
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={upload.isPending}>Téléverser</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
