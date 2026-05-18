import { useState } from "react";
import { MessageSquare, Package, Star } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useClientRequests, useClientReorders, useCreateClientRequest, useCreateClientReorder,
  useCreateQualityControl, useQualityControls,
} from "@/hooks/use-operations";
import { apiErrorMessage } from "@/lib/api";

/**
 * Onglet portail client embarqué dans ClientFichePage.
 * Permet de gérer réclamations, réassorts et contrôles qualité d'un client donné.
 */
export function ClientPortalTab({ clientId }: { clientId: number }) {
  return (
    <Tabs defaultValue="requests">
      <TabsList>
        <TabsTrigger value="requests"><MessageSquare className="mr-2 h-3 w-3" />Réclamations</TabsTrigger>
        <TabsTrigger value="reorders"><Package className="mr-2 h-3 w-3" />Réassorts</TabsTrigger>
        <TabsTrigger value="quality"><Star className="mr-2 h-3 w-3" />Qualité</TabsTrigger>
      </TabsList>
      <TabsContent value="requests" className="mt-4"><RequestsTab clientId={clientId} /></TabsContent>
      <TabsContent value="reorders" className="mt-4"><ReordersTab clientId={clientId} /></TabsContent>
      <TabsContent value="quality" className="mt-4"><QualityTab clientId={clientId} /></TabsContent>
    </Tabs>
  );
}

/**
 * Sous-onglet "Réclamations" — connecté à la table `client_requests`
 * via `/clients/{id}/portal/requests` (ClientPortalController).
 *
 * IMPORTANT : c'est la MÊME table que la page admin globale `/tickets`
 * (ClientRequestController). Une création ici apparaît automatiquement
 * dans la liste cross-clients et dans l'extranet client, grâce à la
 * cascade d'invalidation dans `useCreateClientRequest`.
 *
 * Types alignés sur le DBML : complaint / problem_report.
 * (consumable_reorder a son propre onglet "Réassorts" qui pointe vers
 * une autre table — différence de modèle historique).
 */
function RequestsTab({ clientId }: { clientId: number }) {
  const { data } = useClientRequests(clientId);
  const create = useCreateClientRequest();
  const [form, setForm] = useState({
    type: "complaint" as "complaint" | "problem_report",
    subject: "",
    body: "",
    priority: "normal" as "low" | "normal" | "high" | "urgent",
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(
      // Cast nécessaire : le payload backend a un schéma plus large
      // (status/assigned_to/resolved_at) que les champs du form ici.
      { clientId, payload: form as any },
      {
        onSuccess: () => {
          toast.success("Demande enregistrée — notification envoyée");
          setForm({ ...form, subject: "", body: "" });
        },
        onError: (e) => toast.error(apiErrorMessage(e)),
      },
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Nouvelle entrée</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1">
                <Label>Type</Label>
                <select className="rounded-md border bg-background px-3 py-2 text-sm"
                  value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })}>
                  <option value="complaint">Réclamation</option>
                  <option value="problem_report">Signalement de problème</option>
                </select>
              </div>
              <div className="grid gap-1">
                <Label>Priorité</Label>
                <select className="rounded-md border bg-background px-3 py-2 text-sm"
                  value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as any })}>
                  <option value="low">Basse</option>
                  <option value="normal">Normale</option>
                  <option value="high">Haute</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
            </div>
            <div className="grid gap-1">
              <Label>Sujet *</Label>
              <Input
                required
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Ex: Fuite d'eau dans la cuisine"
              />
            </div>
            <div className="grid gap-1">
              <Label>Message *</Label>
              <Textarea
                required
                rows={4}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Détails de la demande…"
              />
            </div>
            <Button
              type="submit"
              disabled={create.isPending}
              className="bg-gradient-aspha shadow-brand text-white border-0 hover:opacity-95"
            >
              {create.isPending ? "Création…" : "Créer"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Historique</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Sujet</TableHead><TableHead>Type</TableHead>
              <TableHead>Statut</TableHead><TableHead>Date</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">
                    <div className="font-medium">{r.subject}</div>
                    {r.body && (
                      <div className="text-[10px] text-muted-foreground line-clamp-1">{r.body}</div>
                    )}
                  </TableCell>
                  <TableCell><Badge variant="outline">{TYPE_LABEL(r.type)}</Badge></TableCell>
                  <TableCell><Badge>{STATUS_LABEL(r.status)}</Badge></TableCell>
                  <TableCell className="text-xs">{format(new Date(r.created_at), "dd/MM/yy", { locale: fr })}</TableCell>
                </TableRow>
              ))}
              {data?.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">Aucune demande.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// Libellés courts : mapping enums BDD → français
const TYPE_LABEL = (t: string) => ({
  complaint: "Réclamation",
  problem_report: "Signalement",
  consumable_reorder: "Réassort",
} as Record<string, string>)[t] ?? t;

const STATUS_LABEL = (s: string) => ({
  open: "Ouverte",
  in_progress: "En cours",
  resolved: "Résolue",
  closed: "Fermée",
} as Record<string, string>)[s] ?? s;

function ReordersTab({ clientId }: { clientId: number }) {
  const { data } = useClientReorders(clientId);
  const create = useCreateClientReorder();
  const [form, setForm] = useState({ product_name: "", quantity: 1, notes: "" });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate({ clientId, payload: form }, {
      onSuccess: () => { toast.success("Réassort créé"); setForm({ product_name: "", quantity: 1, notes: "" }); },
      onError: (e) => toast.error(apiErrorMessage(e)),
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Nouvelle demande</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-3">
            <div className="grid gap-1"><Label>Produit *</Label>
              <Input required value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} /></div>
            <div className="grid gap-1"><Label>Quantité *</Label>
              <Input type="number" min={1} required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: +e.target.value })} /></div>
            <div className="grid gap-1"><Label>Notes</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "…" : "Créer"}</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Réassorts en cours</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Produit</TableHead><TableHead className="text-right">Qté</TableHead><TableHead>Statut</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">{r.product_name}</TableCell>
                  <TableCell className="text-right">{r.quantity}</TableCell>
                  <TableCell><Badge>{r.status}</Badge></TableCell>
                </TableRow>
              ))}
              {data?.length === 0 && (<TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">Aucun réassort.</TableCell></TableRow>)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function QualityTab({ clientId }: { clientId: number }) {
  const { data } = useQualityControls(clientId);
  const create = useCreateQualityControl();
  const [form, setForm] = useState({ rating: 5, comment: "", control_date: new Date().toISOString().slice(0, 10) });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate({ clientId, payload: form }, {
      onSuccess: () => { toast.success("Contrôle qualité enregistré"); setForm({ ...form, comment: "" }); },
      onError: (e) => toast.error(apiErrorMessage(e)),
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Nouveau contrôle</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-3">
            <div className="grid gap-1"><Label>Date *</Label>
              <Input type="date" required value={form.control_date} onChange={(e) => setForm({ ...form, control_date: e.target.value })} /></div>
            <div className="grid gap-1"><Label>Note (1-5)</Label>
              <Input type="number" min={1} max={5} required value={form.rating} onChange={(e) => setForm({ ...form, rating: +e.target.value })} /></div>
            <div className="grid gap-1"><Label>Commentaire</Label>
              <Textarea rows={4} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} /></div>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "…" : "Enregistrer"}</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Historique qualité</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Note</TableHead><TableHead>Commentaire</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data?.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="text-xs">{format(new Date(q.control_date), "dd/MM/yy", { locale: fr })}</TableCell>
                  <TableCell><span className="text-yellow-500">{"★".repeat(q.rating)}{"☆".repeat(5 - q.rating)}</span></TableCell>
                  <TableCell className="text-sm">{q.comment ?? "—"}</TableCell>
                </TableRow>
              ))}
              {data?.length === 0 && (<TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">Aucun contrôle.</TableCell></TableRow>)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
