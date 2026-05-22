import { useRef, useState } from "react";
import { Download, Plus, Trash2, FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  useDocuments, useUploadDocument, useDeleteDocument,
  type DocumentAudience, type DocumentItem,
} from "@/hooks/use-sub-resources";
import { apiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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

/** Onglets / publics destinataires — l'ordre est celui de l'affichage. */
const AUDIENCES: { value: DocumentAudience; label: string }[] = [
  { value: "client", label: "Client" },
  { value: "intervenant", label: "Intervenant" },
  { value: "encadrement", label: "Encadrement" },
];

/** Fenêtre (jours) en deçà de laquelle une expiration est signalée « proche ». */
const EXPIRY_SOON_DAYS = 30;

type Props = {
  ownerType: "client" | "employee" | "contract" | "invoice" | "quote";
  ownerId: number;
};

/** Statut de la date de fin de validité d'un document. */
type ExpiryStatus = "none" | "ok" | "soon" | "expired";

function expiryStatus(expiry: string | null): ExpiryStatus {
  if (!expiry) return "none";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(expiry + "T00:00:00");
  if (Number.isNaN(date.getTime())) return "none";
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return "expired";
  if (diffDays <= EXPIRY_SOON_DAYS) return "soon";
  return "ok";
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR");
}

export function DocumentsTab({ ownerType, ownerId }: Props) {
  const { data: list = [] } = useDocuments(ownerType, ownerId);
  const upload = useUploadDocument(ownerType, ownerId);
  const del = useDeleteDocument(ownerType, ownerId);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<DocumentAudience>("client");
  const fileInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    label: "",
    document_type: "other" as keyof typeof DOC_TYPE_LABELS,
    audience: "client" as DocumentAudience,
    is_client_visible: false,
    expiry_date: "",
  });

  // Documents historiques sans audience : rattachés à « Encadrement » (interne).
  const docsFor = (audience: DocumentAudience): DocumentItem[] =>
    list.filter((d) =>
      audience === "encadrement"
        ? d.audience === "encadrement" || d.audience == null
        : d.audience === audience,
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileInput.current?.files?.[0];
    // Validation au clic — submit jamais disabled pour raison métier.
    if (!form.label.trim()) {
      toast.error("Renseigne un libellé.");
      return;
    }
    if (!file) {
      toast.error("Sélectionne un fichier à téléverser.");
      return;
    }
    try {
      await upload.mutateAsync({
        label: form.label.trim(),
        document_type: form.document_type,
        audience: form.audience,
        is_client_visible: form.is_client_visible,
        expiry_date: form.expiry_date || null,
        file,
      });
      toast.success("Document téléversé.");
      setOpen(false);
      setForm({
        label: "",
        document_type: "other",
        audience: tab,
        is_client_visible: false,
        expiry_date: "",
      });
      if (fileInput.current) fileInput.current.value = "";
    } catch (err) {
      console.error("Upload document échoué", err);
      toast.error(apiErrorMessage(err, "Échec du téléversement du document"));
    }
  };

  const remove = async (id: number) => {
    try {
      await del.mutateAsync(id);
      toast.success("Document supprimé.");
    } catch (err) {
      console.error("Suppression document échouée", err);
      toast.error(apiErrorMessage(err, "Échec de la suppression du document"));
    }
  };

  const openDialog = () => {
    // Pré-sélectionne le destinataire sur l'onglet courant.
    setForm((f) => ({ ...f, audience: tab }));
    setOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Documents</CardTitle>
          <CardDescription>Contrats, attestations, fiches techniques…</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={openDialog}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Téléverser
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={(v) => setTab(v as DocumentAudience)}>
          <TabsList className="mb-3">
            {AUDIENCES.map((a) => (
              <TabsTrigger key={a.value} value={a.value}>
                {a.label} ({docsFor(a.value).length})
              </TabsTrigger>
            ))}
          </TabsList>
          {AUDIENCES.map((a) => (
            <TabsContent key={a.value} value={a.value}>
              <DocumentList
                docs={docsFor(a.value)}
                onDelete={remove}
                deleting={del.isPending}
              />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Téléverser un document</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Libellé</Label>
              <Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Destinataire</Label>
              <select
                value={form.audience}
                onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value as DocumentAudience }))}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9"
              >
                {AUDIENCES.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                « Encadrement » = interne, jamais visible dans un extranet.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <select value={form.document_type} onChange={(e) => setForm((f) => ({ ...f, document_type: e.target.value as keyof typeof DOC_TYPE_LABELS }))}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9">
                {Object.entries(DOC_TYPE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Date de fin de validité / renouvellement (optionnel)</Label>
              <Input
                type="date"
                value={form.expiry_date}
                onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fichier (max 10 Mo)</Label>
              <Input type="file" ref={fileInput} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_client_visible} onChange={(e) => setForm((f) => ({ ...f, is_client_visible: e.target.checked }))} />
              Visible dans l'extranet du destinataire
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

/** Liste plate des documents d'un onglet (audience). */
function DocumentList({
  docs, onDelete, deleting,
}: {
  docs: DocumentItem[];
  onDelete: (id: number) => void;
  deleting: boolean;
}) {
  if (docs.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun document.</p>;
  }
  return (
    <ul className="space-y-1.5 text-sm">
      {docs.map((d) => {
        const status = expiryStatus(d.expiry_date);
        return (
          <li key={d.id} className="flex items-center justify-between border rounded p-2">
            <div className="flex items-center gap-2 min-w-0">
              {/* Coche verte : un document fourni pour cette ligne. */}
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <div className="font-medium truncate">{d.label}</div>
                <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <Badge variant="outline" className="text-xs">{DOC_TYPE_LABELS[d.document_type] ?? d.document_type}</Badge>
                  {d.size_kb ? <span>{d.size_kb} ko</span> : null}
                  {d.is_client_visible && <Badge className="text-xs">Visible extranet</Badge>}
                  {status !== "none" && (
                    <span
                      className={
                        status === "expired"
                          ? "inline-flex items-center gap-1 text-destructive font-medium"
                          : status === "soon"
                            ? "inline-flex items-center gap-1 text-amber-600 font-medium"
                            : "inline-flex items-center gap-1 text-muted-foreground"
                      }
                    >
                      {(status === "expired" || status === "soon") && (
                        <AlertTriangle className="h-3 w-3" />
                      )}
                      {status === "expired" ? "Expiré le " : "Valide jusqu'au "}
                      {formatDate(d.expiry_date!)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <a href={d.download_url} target="_blank" rel="noreferrer">
                <Button size="sm" variant="ghost"><Download className="h-3.5 w-3.5" /></Button>
              </a>
              <button
                onClick={() => onDelete(d.id)}
                disabled={deleting}
                className="text-destructive hover:bg-destructive/10 p-2 rounded disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
