import { useState } from "react";
import { Save, Settings as SettingsIcon, Plug } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";

type Setting = {
  id: number;
  key: string;
  category: string;
  label: string;
  description: string | null;
  value: any;
  value_type: "string" | "integer" | "boolean" | "array" | "secret";
  is_secret: boolean;
  is_set: boolean;
};

const CATEGORIES = [
  { id: "planning", label: "Planning", icon: SettingsIcon },
  { id: "travel", label: "Trajets", icon: SettingsIcon },
  { id: "stock", label: "Stock", icon: SettingsIcon },
  { id: "integrations", label: "Intégrations", icon: Plug },
];

export function SettingsPage() {
  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await api.get<{ data: Setting[] }>("/settings")).data.data,
  });

  return (
    <div>
      <PageHeader
        title="Paramètres"
        description="Configuration globale paramétrable par le super-admin."
      />

      <Tabs defaultValue="planning">
        <TabsList>
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <TabsTrigger key={c.id} value={c.id}>
                <Icon className="mr-2 h-3 w-3" />{c.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {CATEGORIES.map((cat) => (
          <TabsContent key={cat.id} value={cat.id} className="space-y-3 mt-4">
            {isLoading ? (
              [...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)
            ) : (
              settings?.filter((s) => s.category === cat.id).map((s) => (
                <SettingCard key={s.id} setting={s} />
              ))
            )}
            {!isLoading && settings?.filter((s) => s.category === cat.id).length === 0 && (
              <p className="text-sm text-muted-foreground">Aucun paramètre dans cette catégorie.</p>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function SettingCard({ setting }: { setting: Setting }) {
  const qc = useQueryClient();
  const [value, setValue] = useState(setting.value ?? "");
  const update = useMutation({
    mutationFn: async (v: any) => (await api.patch(`/settings/${setting.key}`, { value: v })).data.data,
    onSuccess: () => {
      toast.success("Paramètre enregistré");
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["settings", "public"] });
    },
    onError: () => toast.error("Erreur lors de l'enregistrement"),
  });

  const onSave = () => {
    let v: any = value;
    if (setting.value_type === "integer") v = parseInt(value, 10);
    if (setting.value_type === "boolean") v = !!value;
    update.mutate(v);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{setting.label}</CardTitle>
            {setting.description && <CardDescription className="mt-1">{setting.description}</CardDescription>}
          </div>
          {setting.is_secret && <Badge variant="outline">Confidentiel</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2 max-w-md">
          <div className="flex-1 space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {setting.value_type === "integer" ? "Valeur numérique" : setting.value_type === "boolean" ? "Activé / Désactivé" : "Valeur"}
            </Label>
            {setting.value_type === "boolean" ? (
              <select className="rounded-md border bg-background px-3 py-2 text-sm h-9 w-full"
                value={String(value)} onChange={(e) => setValue(e.target.value === "true")}>
                <option value="true">Activé</option>
                <option value="false">Désactivé</option>
              </select>
            ) : setting.value_type === "integer" ? (
              <Input type="number" value={value ?? ""} onChange={(e) => setValue(e.target.value)} />
            ) : (
              <Input
                type={setting.is_secret ? "password" : "text"}
                value={value ?? ""}
                placeholder={setting.is_secret && setting.is_set ? "Définie (laisser vide pour ne pas changer)" : ""}
                onChange={(e) => setValue(e.target.value)}
              />
            )}
          </div>
          <Button onClick={onSave} disabled={update.isPending}>
            <Save className="h-3.5 w-3.5 mr-1.5" />
            Enregistrer
          </Button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{setting.key}</code>
          {setting.is_set ? (
            <span className="text-[10px] text-emerald-600">✓ Défini</span>
          ) : (
            <span className="text-[10px] text-muted-foreground">Non défini</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
