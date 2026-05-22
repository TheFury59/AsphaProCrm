import {
  Calendar, Clock, QrCode, Heart, Star, AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useEmployeeScore, type EmployeeScore } from "@/hooks/use-employees";

/**
 * Onglet « Notation » de la fiche intervenant (admin).
 *
 * Affiche la note globale (gros chiffre coloré selon le niveau) + les 4
 * critères (absences, assiduité, badgeage, relation) avec leur note, une
 * barre de progression colorée, et le détail lisible renvoyé par le backend.
 *
 * La note est calculée côté serveur (EmployeeScoringService) à partir des
 * données réelles — il n'y a aucune table de notation à alimenter.
 */

/** Vert ≥ 75, ambre ≥ 50, rouge en dessous. */
function levelColor(score: number): { text: string; bg: string; bar: string; label: string } {
  if (score >= 75) {
    return { text: "text-emerald-600", bg: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500", label: "Bon" };
  }
  if (score >= 50) {
    return { text: "text-amber-600", bg: "bg-amber-100 text-amber-700", bar: "bg-amber-500", label: "À surveiller" };
  }
  return { text: "text-rose-600", bg: "bg-rose-100 text-rose-700", bar: "bg-rose-500", label: "Critique" };
}

const CRITERIA: {
  key: keyof EmployeeScore["criteria"];
  label: string;
  icon: typeof Calendar;
  hint: string;
}[] = [
  { key: "absences", label: "Absences", icon: Calendar, hint: "Nombre et justification des absences" },
  { key: "assiduite", label: "Assiduité", icon: Clock, hint: "Ponctualité au pointage" },
  { key: "badgeage", label: "Badgeage", icon: QrCode, hint: "Taux d'interventions badgées" },
  { key: "relation", label: "Relation", icon: Heart, hint: "Tickets avec faute imputée" },
];

export function EmployeeScoreTab({ employeeId }: { employeeId: number }) {
  const { data: score, isLoading, isError } = useEmployeeScore(employeeId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <div className="grid sm:grid-cols-2 gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !score) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
          Impossible de charger la notation de cet intervenant.
        </CardContent>
      </Card>
    );
  }

  const global = levelColor(score.global);

  return (
    <div className="space-y-4">
      {/* Note globale — mise en valeur */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4 text-primary" /> Note globale
          </CardTitle>
          <CardDescription>
            Calculée sur les {score.period.days} derniers jours
            {" "}({score.period.since} → {score.period.until}). Moyenne pondérée des 4 critères.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className={"text-6xl font-bold tabular-nums " + global.text}>
                {score.global}
                <span className="text-2xl text-muted-foreground font-medium">/100</span>
              </div>
              <span className={"inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-semibold " + global.bg}>
                {global.label}
              </span>
            </div>
            <div className="flex-1">
              <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={"h-full rounded-full transition-all " + global.bar}
                  style={{ width: `${score.global}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                La note décroît avec les absences, les retards au pointage, les
                RDV non badgés et les tickets où l'intervenant est désigné fautif.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4 critères */}
      <div className="grid sm:grid-cols-2 gap-4">
        {CRITERIA.map(({ key, label, icon: Icon, hint }) => {
          const value = score.criteria[key];
          const detail = score.details[key];
          const c = levelColor(value);
          return (
            <Card key={key}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" /> {label}
                  </CardTitle>
                  <span className={"text-2xl font-bold tabular-nums " + c.text}>
                    {value}
                    <span className="text-sm text-muted-foreground font-medium">/100</span>
                  </span>
                </div>
                <CardDescription>{hint}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={"h-full rounded-full transition-all " + c.bar}
                    style={{ width: `${value}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {detail?.summary ?? "—"}
                  {detail?.neutral && (
                    <span className="ml-1 italic">(aucune donnée — note neutre)</span>
                  )}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
