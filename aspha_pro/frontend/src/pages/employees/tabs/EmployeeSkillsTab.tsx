import { useEffect, useState } from "react";
import { useSkills, useSyncEmployeeSkills } from "@/hooks/use-sub-resources";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";

type Props = {
  employeeId: number;
  currentSkillIds: number[];
};

export function EmployeeSkillsTab({ employeeId, currentSkillIds }: Props) {
  const { data: skills = [] } = useSkills();
  const sync = useSyncEmployeeSkills(employeeId);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    setSelected(new Set(currentSkillIds));
  }, [currentSkillIds.join(",")]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    await sync.mutateAsync(Array.from(selected));
  };

  const dirty = Array.from(selected).sort().join(",") !== currentSkillIds.slice().sort().join(",");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Compétences</CardTitle>
          <CardDescription>Cocher les compétences maîtrisées par l'intervenant</CardDescription>
        </div>
        <Button size="sm" onClick={save} disabled={!dirty || sync.isPending}>
          {sync.isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </CardHeader>
      <CardContent>
        {skills.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune compétence dans le référentiel. Pauline doit fournir la liste.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {skills.map((s) => {
              const active = selected.has(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s.id)}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? "border-primary bg-primary text-primary-foreground font-medium"
                      : "border-input hover:bg-accent"
                  }`}
                >
                  {active && <Check className="h-3 w-3" />}
                  {s.label}
                </button>
              );
            })}
          </div>
        )}
        {dirty && (
          <Badge variant="secondary" className="mt-3">Modifications non enregistrées</Badge>
        )}
      </CardContent>
    </Card>
  );
}
