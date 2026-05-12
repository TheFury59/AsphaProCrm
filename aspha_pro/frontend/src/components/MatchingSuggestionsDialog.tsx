import { Sparkles, MapPin, Calendar, Star } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useMatchingSuggestions } from "@/hooks/use-fleet";
import { api } from "@/lib/api";

/**
 * Dialog d'aide à l'affectation : appelle GET /interventions/{id}/match
 * et liste les meilleurs candidats avec leur score décomposé.
 * Clic sur "Affecter" → PATCH intervention.employee_id = candidate.id.
 */
export function MatchingSuggestionsDialog({
  interventionId,
  open,
  onClose,
  onAssigned,
}: {
  interventionId: number | null;
  open: boolean;
  onClose: () => void;
  onAssigned?: () => void;
}) {
  const { data: candidates, isLoading } = useMatchingSuggestions(open ? interventionId : null);

  const assign = async (employeeId: number) => {
    if (!interventionId) return;
    try {
      await api.patch(`/interventions/${interventionId}`, { employee_id: employeeId });
      toast.success("Intervenant affecté");
      onAssigned?.();
      onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? "Erreur d'affectation");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Suggestions d'affectation
          </DialogTitle>
          <DialogDescription>
            Top candidats classés par score composite (compétences + proximité + disponibilité + préférence).
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Calcul des candidats…</p>
        ) : (candidates?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Aucun candidat éligible.</p>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {candidates?.map((c, i) => (
              <Card key={c.employee_id} className={i === 0 ? "border-primary" : ""}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="text-2xl font-bold w-12 text-center text-primary">
                    {c.score.toFixed(0)}
                    <span className="text-xs text-muted-foreground">/100</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{c.employee_name}</div>
                    <div className="flex flex-wrap gap-1.5 mt-1 text-[10px]">
                      <Badge variant="outline" className="gap-1">
                        <Star className="h-2.5 w-2.5" />Skills {c.breakdown.skills}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <MapPin className="h-2.5 w-2.5" />
                        {c.breakdown.distance_km !== null ? `${c.breakdown.distance_km} km` : "—"}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <Calendar className="h-2.5 w-2.5" />Dispo {c.breakdown.availability}
                      </Badge>
                      {c.breakdown.preference > 0 && (
                        <Badge variant="default" className="gap-1">Client connu</Badge>
                      )}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => assign(c.employee_id)}>Affecter</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
