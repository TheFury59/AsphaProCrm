import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/**
 * Hook qui vérifie en temps réel si un RDV en projet entre en conflit
 * avec les autres RDV de l'intervenant le même jour.
 *
 * Trois types de conflits détectés (cf. InterventionConflictDetector backend) :
 *  - overlap        : 2 RDV qui se chevauchent (erreur)
 *  - travel_before  : pas le temps d'arriver depuis le RDV précédent (warning)
 *  - travel_after   : pas le temps de partir vers le RDV suivant (warning)
 *
 * Debounce 500ms pour éviter de hammer le backend à chaque touche dans
 * les inputs date/heure.
 *
 * Le check ne fire QUE si on a tous les paramètres requis (employee + client
 * + dates valides + heure fin > heure début).
 */

export type ConflictItem = {
  type: "overlap" | "travel_before" | "travel_after";
  severity: "error" | "warning";
  message: string;
  other_intervention_id?: number;
  other_client?: string;
  other_start?: string;
  other_end?: string;
  travel_minutes?: number;
  missing_minutes?: number;
};

export type ConflictParams = {
  employee_id: number | null;
  client_id: number | null;
  start_datetime: string | null;
  end_datetime: string | null;
  address_id?: number | null;
  /** Pour update : on ignore le RDV lui-même dans la détection. */
  intervention_id?: number | null;
};

export function useConflictCheck(params: ConflictParams) {
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  // On serialize les params dans une key stable pour les deps useEffect
  const key = JSON.stringify(params);

  useEffect(() => {
    // Pas de check si paramètres incomplets
    if (
      !params.employee_id
      || !params.client_id
      || !params.start_datetime
      || !params.end_datetime
    ) {
      setConflicts([]);
      return;
    }
    // Heure fin > heure début (sinon validation client-side avant submit)
    if (new Date(params.end_datetime) <= new Date(params.start_datetime)) {
      setConflicts([]);
      return;
    }

    // Debounce 500ms — évite spam pendant la saisie
    const t = setTimeout(async () => {
      setIsChecking(true);
      try {
        const { data } = await api.post<{
          data: { conflicts: ConflictItem[]; has_conflict: boolean; has_error: boolean };
        }>("/interventions/check-conflict", params);
        setConflicts(data.data.conflicts);
      } catch {
        // Silent fail : si l'API échoue, on ne bloque rien — l'utilisateur
        // peut toujours créer et le backend re-valide à la création.
        setConflicts([]);
      } finally {
        setIsChecking(false);
      }
    }, 500);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return {
    conflicts,
    isChecking,
    hasError: conflicts.some((c) => c.severity === "error"),
    hasWarning: conflicts.some((c) => c.severity === "warning"),
  };
}
