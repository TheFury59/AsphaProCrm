import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Save } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

type PermissionsData = {
  roles: { id: number; name: string }[];
  permissions: { id: number; name: string }[];
  grouped: Record<string, { id: number; name: string }[]>;
  matrix: Record<string, number[]>;
};

/**
 * Matrice rôle × permission avec checkboxes.
 * Groupée par module (clients, employees, planning, sales, etc.).
 * Le rôle super_admin n'est pas modifiable (a toutes les permissions par construction).
 */
export function PermissionsMatrix() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin", "permissions"],
    queryFn: async () => (await api.get<{ data: PermissionsData }>("/admin/permissions")).data.data,
  });

  const [local, setLocal] = useState<Record<string, Set<number>>>({});

  useEffect(() => {
    if (data) {
      const init: Record<string, Set<number>> = {};
      Object.entries(data.matrix).forEach(([role, ids]) => {
        init[role] = new Set(ids);
      });
      setLocal(init);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async ({ role, ids }: { role: string; ids: number[] }) =>
      (await api.put(`/admin/roles/${role}/permissions`, { permission_ids: ids })).data,
    onSuccess: (_d, vars) => {
      toast.success(`Permissions du rôle "${vars.role}" enregistrées`);
      qc.invalidateQueries({ queryKey: ["admin", "permissions"] });
    },
    onError: () => toast.error("Erreur lors de l'enregistrement"),
  });

  if (!data) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  const editableRoles = data.roles.filter((r) => r.name !== "super_admin");

  const toggle = (role: string, permId: number) => {
    setLocal((prev) => {
      const next = { ...prev };
      const set = new Set(next[role] ?? []);
      if (set.has(permId)) set.delete(permId);
      else set.add(permId);
      next[role] = set;
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            Matrice des permissions
          </CardTitle>
          <CardDescription>
            Coche les permissions par rôle. Le rôle <Badge variant="secondary" className="text-[10px]">super_admin</Badge> a tout par construction (non modifiable).
          </CardDescription>
        </CardHeader>
      </Card>

      {Object.entries(data.grouped).map(([module, perms]) => (
        <Card key={module}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm capitalize">{module}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium">Permission</th>
                    {editableRoles.map((r) => (
                      <th key={r.id} className="px-3 py-2 text-center font-medium">{r.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {perms.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-1.5 pr-4 font-mono text-[11px]">{p.name}</td>
                      {editableRoles.map((r) => (
                        <td key={r.id} className="px-3 py-1.5 text-center">
                          <Checkbox
                            checked={local[r.name]?.has(p.id) ?? false}
                            onCheckedChange={() => toggle(r.name, p.id)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end gap-2 sticky bottom-2 bg-background/95 backdrop-blur p-2 border rounded-md">
        {editableRoles.map((r) => (
          <Button
            key={r.id}
            size="sm"
            onClick={() => save.mutate({ role: r.name, ids: [...(local[r.name] ?? [])] })}
            disabled={save.isPending}
          >
            <Save className="h-3 w-3 mr-1.5" />
            Enregistrer {r.name}
          </Button>
        ))}
      </div>
    </div>
  );
}
