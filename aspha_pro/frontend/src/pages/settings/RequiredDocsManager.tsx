import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileWarning, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";

type RequiredDocType = {
  id: number;
  label: string;
  category_match: string | null;
  applies_to: "all" | "cadre" | "non_cadre";
  is_mandatory: boolean;
  description: string | null;
  display_order: number;
};

/**
 * Gestion du référentiel des documents requis sur fiche intervenant.
 * Le super-admin peut ajouter/modifier/supprimer les types.
 */
export function RequiredDocsManager() {
  const qc = useQueryClient();
  const { data: types } = useQuery({
    queryKey: ["required-doc-types"],
    queryFn: async () => (await api.get<{ data: RequiredDocType[] }>("/required-document-types")).data.data,
  });
  const [openCreate, setOpenCreate] = useState(false);

  const del = useMutation({
    mutationFn: async (id: number) => { await api.delete(`/required-document-types/${id}`); },
    onSuccess: () => {
      toast.success("Type supprimé");
      qc.invalidateQueries({ queryKey: ["required-doc-types"] });
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileWarning className="h-4 w-4" />
              Documents requis intervenants
            </CardTitle>
            <CardDescription>
              Référentiel des documents attendus sur chaque fiche intervenant. Les manquants apparaissent en alerte sur la fiche.
            </CardDescription>
          </div>
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-3 w-3 mr-1" />Nouveau type</Button>
            </DialogTrigger>
            <CreateTypeDialog onClose={() => setOpenCreate(false)} onCreated={() => qc.invalidateQueries({ queryKey: ["required-doc-types"] })} />
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Code catégorie</TableHead>
                <TableHead>Applique à</TableHead>
                <TableHead>Obligatoire</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {types?.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.label}</TableCell>
                  <TableCell className="font-mono text-xs">{t.category_match ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline">{t.applies_to}</Badge></TableCell>
                  <TableCell>
                    {t.is_mandatory ? <Badge variant="destructive">Obligatoire</Badge> : <Badge variant="secondary">Optionnel</Badge>}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => del.mutate(t.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {types?.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Aucun type défini.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function CreateTypeDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    label: "",
    category_match: "",
    applies_to: "all" as "all" | "cadre" | "non_cadre",
    is_mandatory: true,
  });

  const create = useMutation({
    mutationFn: async () => (await api.post("/required-document-types", form)).data.data,
    onSuccess: () => { toast.success("Type créé"); onCreated(); onClose(); },
    onError: () => toast.error("Erreur"),
  });

  return (
    <DialogContent>
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
        <DialogHeader><DialogTitle>Nouveau type de document requis</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-3">
          <div className="grid gap-1">
            <Label>Label *</Label>
            <Input required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Ex : Permis de conduire" />
          </div>
          <div className="grid gap-1">
            <Label>Code catégorie (pour matcher les documents uploadés)</Label>
            <Input value={form.category_match} onChange={(e) => setForm({ ...form, category_match: e.target.value })} placeholder="permis" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label>S'applique à</Label>
              <select className="rounded-md border bg-background px-3 py-2 text-sm h-9"
                value={form.applies_to} onChange={(e) => setForm({ ...form, applies_to: e.target.value as any })}>
                <option value="all">Tous</option>
                <option value="cadre">Cadre uniquement</option>
                <option value="non_cadre">Non-cadre uniquement</option>
              </select>
            </div>
            <div className="grid gap-1">
              <Label>Obligatoire</Label>
              <select className="rounded-md border bg-background px-3 py-2 text-sm h-9"
                value={String(form.is_mandatory)} onChange={(e) => setForm({ ...form, is_mandatory: e.target.value === "true" })}>
                <option value="true">Oui</option>
                <option value="false">Non</option>
              </select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={create.isPending}>Créer</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
