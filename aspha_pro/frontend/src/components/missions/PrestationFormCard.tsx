import { useState } from "react";
import {
  Package, Trash2, Calendar as CalIcon, Repeat, Lock, Clock, Loader2,
  UserPlus, X, MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { AvailableEmployeesMap } from "@/pages/planning/AvailableEmployeesMap";
import type { PrestationDraft } from "@/hooks/use-missions";

/**
 * Carte d'édition d'une prestation contractualisée — formulaire UNIQUE et
 * partagé entre la création de mission (CreateMissionPage) et l'édition de
 * mission (EditMissionPage).
 *
 * Couvre : produit catalogue, libellé, type de facturation, dates, prix
 * verrouillé (case « Prix personnalisé »), nature (Ponctuelle / Récurrente)
 * et le bloc de récurrence complet (fréquence, intervalle, jours, horaires, fin).
 *
 * Le composant est purement contrôlé : il ne persiste rien lui-même. Les pages
 * appelantes décident quoi faire des changements (batch local en création,
 * mutation par prestation en édition).
 */

// =========================================================================
// Constantes métier partagées (cf. DBML)
// =========================================================================

export const BILLING_TYPES = [
  { value: "hourly", label: "Horaire" },
  { value: "forfait", label: "Forfait" },
  { value: "frais", label: "Frais" },
  { value: "remise", label: "Remise" },
  { value: "carte", label: "Carte" },
  { value: "exceptional", label: "Exceptionnel" },
] as const;

/** Moyens de paiement acceptés par une mission (cf. DBML). */
export const PAYMENT_METHODS = [
  { value: "check", label: "Chèque" },
  { value: "sepa", label: "Prélèvement SEPA" },
  { value: "card", label: "Carte bancaire" },
  { value: "transfer", label: "Virement" },
  { value: "cash", label: "Espèces" },
] as const;

/** Rythmes de facturation d'une mission (cf. DBML). */
export const BILLING_RHYTHMS = [
  { value: "weekly", label: "Hebdomadaire" },
  { value: "biweekly", label: "Quinzaine" },
  { value: "monthly", label: "Mensuel" },
  { value: "quarterly", label: "Trimestriel" },
  { value: "per_intervention", label: "À la prestation" },
] as const;

// Jours de la semaine — codes alignés sur le moteur InterventionExpander.
export const WEEKDAYS = [
  { code: "mon", label: "L" },
  { code: "tue", label: "M" },
  { code: "wed", label: "M" },
  { code: "thu", label: "J" },
  { code: "fri", label: "V" },
  { code: "sat", label: "S" },
  { code: "sun", label: "D" },
] as const;

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Normalise une valeur de date vers `YYYY-MM-DD`.
 *
 * Le backend peut renvoyer une date soit déjà au format court (`2026-05-21`),
 * soit — pour des enregistrements antérieurs au fix du cast `date:Y-m-d` — sous
 * forme de datetime ISO (`2026-05-20T22:00:00.000000Z`). Dans ce dernier cas on
 * extrait UNIQUEMENT la partie `YYYY-MM-DD`, sans passer par `new Date()` (qui
 * réintroduirait un décalage de fuseau horaire). Indispensable pour que
 * `<input type="date">` affiche la valeur et pour éviter la dérive au re-save.
 */
export function toDateInput(value: string | null | undefined): string | null {
  if (!value) return null;
  // "2026-05-21" ou "2026-05-21T..." → on coupe au "T", sinon au premier espace.
  const m = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/**
 * Normalise une heure vers `HH:MM` (format attendu par `<input type="time">`).
 *
 * Le backend stocke `recurrence_start_time`/`recurrence_end_time` dans une
 * colonne SQL `time` : PostgreSQL les renvoie en `HH:MM:SS` (`09:00:00`).
 * `<input type="time">` n'accepte que `HH:MM` → on tronque les secondes.
 * Indispensable pour pré-remplir le champ à la modification d'une mission.
 */
export function toTimeInput(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = String(value).match(/^(\d{2}:\d{2})/);
  return m ? m[1] : null;
}

/** Une prestation vierge — utilisée par les deux pages pour « Ajouter ». */
export function emptyPrestation(): PrestationDraft {
  return {
    product_id: null,
    label: "",
    duration_minutes: null,
    start_date: todayStr(),
    end_date: null,
    billing_type: "hourly",
    pricing_type: "default",
    custom_price: null,
    base_price: null,
    no_intervention_no_bill: false,
    nature: "punctual",
    recurrence_frequency: "weekly",
    recurrence_interval: 1,
    recurrence_days_of_week: "mon",
    recurrence_start_time: "09:00",
    recurrence_end_time: "11:00",
    recurrence_end_type: "never",
    recurrence_occurrences_count: null,
    default_employee_id: null,
    default_employee_name: null,
  };
}

/**
 * Règles de validation métier d'une prestation (réutilisées au clic submit
 * par les deux pages). Retourne la liste des erreurs (vide = OK).
 */
export function validatePrestation(p: PrestationDraft, labelPrefix = "Prestation"): string[] {
  const errs: string[] = [];
  if (!p.label.trim()) errs.push(`${labelPrefix} : libellé manquant.`);
  if (p.pricing_type === "custom" && (p.custom_price == null || p.custom_price < 0)) {
    errs.push(`${labelPrefix} : prix personnalisé invalide.`);
  }
  if (p.nature === "regular") {
    if (!p.recurrence_frequency) errs.push(`${labelPrefix} : fréquence de récurrence manquante.`);
    if (p.recurrence_frequency === "weekly" && !p.recurrence_days_of_week?.trim()) {
      errs.push(`${labelPrefix} : choisis au moins un jour de la semaine.`);
    }
    if (!p.recurrence_start_time || !p.recurrence_end_time) {
      errs.push(`${labelPrefix} : heures de début/fin manquantes.`);
    }
    if (
      p.recurrence_start_time &&
      p.recurrence_end_time &&
      p.recurrence_end_time <= p.recurrence_start_time
    ) {
      errs.push(`${labelPrefix} : l'heure de fin doit suivre l'heure de début.`);
    }
    if (p.recurrence_end_type === "on_date" && !p.end_date) {
      errs.push(`${labelPrefix} : date de fin requise (fin de récurrence "à une date").`);
    }
    if (
      p.recurrence_end_type === "after_occurrences" &&
      (p.recurrence_occurrences_count == null || p.recurrence_occurrences_count < 1)
    ) {
      errs.push(`${labelPrefix} : nombre d'occurrences invalide.`);
    }
  }
  return errs;
}

/**
 * Sérialise une prestation pour l'API : ne transmet les champs de récurrence
 * que si la nature est `regular`, sinon `null` (le backend ne génère rien
 * pour une ponctuelle). Identique entre création et édition.
 */
export function serializePrestation(p: PrestationDraft) {
  const isRecurring = p.nature === "regular";
  return {
    product_id: p.product_id || null,
    label: p.label.trim(),
    // C4 2026-05-22 — durée standard saisie sur la prestation (vide = null)
    duration_minutes: p.duration_minutes != null ? Number(p.duration_minutes) : null,
    // Normalisation `YYYY-MM-DD` : protège contre un datetime ISO hérité d'un
    // ancien enregistrement (sinon la date dérive de -1 jour au re-save).
    start_date: toDateInput(p.start_date),
    end_date: toDateInput(p.end_date),
    billing_type: p.billing_type ?? null,
    pricing_type: p.pricing_type ?? "default",
    base_price: p.base_price != null ? Number(p.base_price) : null,
    custom_price:
      p.pricing_type === "custom" && p.custom_price != null ? Number(p.custom_price) : null,
    no_intervention_no_bill: !!p.no_intervention_no_bill,
    nature: p.nature ?? "punctual",
    recurrence_frequency: isRecurring ? p.recurrence_frequency ?? null : null,
    recurrence_interval: isRecurring ? Number(p.recurrence_interval ?? 1) : null,
    recurrence_days_of_week:
      isRecurring && p.recurrence_frequency === "weekly"
        ? p.recurrence_days_of_week ?? null
        : null,
    // `toTimeInput` : tronque d'éventuelles secondes (`09:00:00` → `09:00`)
    // pour transmettre un format propre, cohérent avec l'<input type="time">.
    recurrence_start_time: isRecurring ? toTimeInput(p.recurrence_start_time) : null,
    recurrence_end_time: isRecurring ? toTimeInput(p.recurrence_end_time) : null,
    recurrence_end_type: isRecurring ? p.recurrence_end_type ?? "never" : null,
    recurrence_occurrences_count:
      isRecurring && p.recurrence_end_type === "after_occurrences"
        ? Number(p.recurrence_occurrences_count ?? 1)
        : null,
    // Intervenant par défaut : pertinent uniquement pour une prestation
    // récurrente (les RDV ponctuels sont créés/affectés manuellement).
    default_employee_id: isRecurring ? p.default_employee_id ?? null : null,
  };
}

// =========================================================================
// Composant
// =========================================================================

export function PrestationFormCard({
  idx,
  prestation: p,
  products,
  canRemove,
  onChange,
  onProductPick,
  onRemove,
  /** Libellé du bouton de suppression / icône (« Supprimer » par défaut). */
  removeTitle,
  /** Spinner sur le bouton de suppression (mutation en cours en mode édition). */
  removing = false,
  /** En-tête optionnel rendu en haut de la carte (ex: actions « Enregistrer »). */
  headerExtra,
  /**
   * Id du client de la mission — requis pour la carte de suggestion
   * d'intervenants (calcul des distances). Si absent, le bouton « Assigner
   * un intervenant » est masqué.
   */
  clientId,
}: {
  idx: number;
  prestation: PrestationDraft;
  products: any[];
  canRemove: boolean;
  onChange: (patch: Partial<PrestationDraft>) => void;
  onProductPick: (productId: string) => void;
  onRemove: () => void;
  removeTitle?: string;
  removing?: boolean;
  headerExtra?: React.ReactNode;
  clientId?: number | null;
}) {
  const isCustomPrice = p.pricing_type === "custom";
  const isRecurring = p.nature === "regular";
  const effectivePrice = isCustomPrice ? p.custom_price : p.base_price;
  const [assignOpen, setAssignOpen] = useState(false);

  // Verrouillage du prix : par défaut le prix affiché = prix catalogue
  // (base_price), en lecture seule. La case « Prix personnalisé » le déverrouille.
  const togglePricing = (custom: boolean) => {
    onChange({
      pricing_type: custom ? "custom" : "default",
      custom_price: custom ? (p.custom_price ?? p.base_price ?? null) : null,
    });
  };

  // Toggle d'un jour de la semaine (CSV mon,wed,fri).
  const toggleDay = (code: string) => {
    const days = (p.recurrence_days_of_week ?? "")
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);
    const next = days.includes(code)
      ? days.filter((d) => d !== code)
      : [...days, code];
    const ordered = WEEKDAYS.filter((w) => next.includes(w.code)).map((w) => w.code);
    onChange({ recurrence_days_of_week: ordered.join(",") });
  };

  const activeDays = (p.recurrence_days_of_week ?? "").split(",").map((d) => d.trim());

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2.5 shadow-sm">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px] font-mono">#{idx + 1}</Badge>
        <Package className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium flex-1 truncate">
          {p.label || <em className="text-muted-foreground">Nouvelle prestation</em>}
        </span>
        {isRecurring && (
          <Badge variant="secondary" className="text-[9px] h-4 gap-0.5">
            <Repeat className="h-2.5 w-2.5" /> Récurrente
          </Badge>
        )}
        {effectivePrice != null && (
          <span className="text-xs font-semibold tabular-nums">
            {Number(effectivePrice).toFixed(2)} €
          </span>
        )}
        {headerExtra}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-rose-600 hover:text-rose-700"
          onClick={onRemove}
          disabled={!canRemove || removing}
          title={
            removeTitle ??
            (canRemove ? "Supprimer cette prestation" : "Au moins une prestation est requise")
          }
        >
          {removing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <Label className="text-[10px]">Produit du catalogue</Label>
          <Select
            value={p.product_id ? String(p.product_id) : "none"}
            onValueChange={(v) => onProductPick(v === "none" ? "" : v)}
          >
            <SelectTrigger><SelectValue placeholder="Sélectionner un produit…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Libre (sans produit) —</SelectItem>
              {products.map((prod: any) => (
                <SelectItem key={prod.id} value={String(prod.id)}>
                  <span className="font-mono text-[10px] mr-2">{prod.code}</span>
                  {prod.name}
                  <span className="text-muted-foreground ml-1">
                    ({Number(prod.price).toFixed(2)} €)
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2">
          <Label className="text-[10px]">Libellé *</Label>
          <Input
            value={p.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Ex: Ménage 2h"
          />
        </div>

        {/* C4 2026-05-22 — durée standard saisie sur la prestation (optionnelle) */}
        <div className="col-span-2">
          <Label className="text-[10px] flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Durée (min)
          </Label>
          <Input
            type="number"
            min="0"
            step="1"
            value={p.duration_minutes ?? ""}
            onChange={(e) =>
              onChange({ duration_minutes: e.target.value ? Number(e.target.value) : null })
            }
            placeholder="Durée standard en minutes (optionnel)"
          />
        </div>

        <div>
          <Label className="text-[10px]">Type facturation</Label>
          <Select
            value={p.billing_type ?? "hourly"}
            onValueChange={(v) => onChange({ billing_type: v as PrestationDraft["billing_type"] })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {BILLING_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-[10px] flex items-center gap-1">
            <CalIcon className="h-3 w-3" />
            Début
          </Label>
          <Input
            type="date"
            value={p.start_date ?? ""}
            onChange={(e) => onChange({ start_date: e.target.value || null })}
          />
        </div>
      </div>

      {/* ============== Prix verrouillé + case "Prix personnalisé" ============== */}
      <div className="rounded-md border bg-muted/30 p-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
            {!isCustomPrice && <Lock className="h-3 w-3" />}
            Prix de la prestation
          </Label>
          <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
            <input
              type="checkbox"
              checked={isCustomPrice}
              onChange={(e) => togglePricing(e.target.checked)}
            />
            <span className={isCustomPrice ? "font-medium text-amber-600" : "text-muted-foreground"}>
              Prix personnalisé
            </span>
          </label>
        </div>
        {!isCustomPrice ? (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={p.base_price ?? ""}
              readOnly
              disabled
              className="bg-muted cursor-not-allowed"
              placeholder="Prix catalogue"
            />
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              Tarif catalogue
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={p.custom_price ?? ""}
              onChange={(e) =>
                onChange({ custom_price: e.target.value ? Number(e.target.value) : null })
              }
              placeholder="Prix négocié (€)"
              autoFocus
            />
            <span className="text-[10px] text-amber-600 whitespace-nowrap">
              Catalogue : {p.base_price != null ? `${Number(p.base_price).toFixed(2)} €` : "—"}
            </span>
          </div>
        )}
      </div>

      {/* ============== Nature : Ponctuelle / Récurrente ============== */}
      <div className="rounded-md border p-2.5 space-y-2.5">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          Nature de la prestation
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {([
            { val: "punctual", label: "Ponctuelle", desc: "RDV créés manuellement" },
            { val: "regular", label: "Récurrente", desc: "RDV générés automatiquement" },
          ] as const).map((opt) => {
            const active = (p.nature ?? "punctual") === opt.val;
            return (
              <button
                key={opt.val}
                type="button"
                onClick={() => onChange({ nature: opt.val })}
                className={
                  "text-left rounded-md border px-2.5 py-1.5 transition-colors " +
                  (active
                    ? "border-primary bg-primary/10"
                    : "border-input hover:bg-muted")
                }
              >
                <div className={"text-xs font-medium " + (active ? "text-primary" : "")}>
                  {opt.label}
                </div>
                <div className="text-[10px] text-muted-foreground">{opt.desc}</div>
              </button>
            );
          })}
        </div>

        {/* Formulaire de récurrence COMPLET (si nature = récurrente) */}
        {isRecurring && (
          <div className="space-y-2.5 pt-1 border-t mt-1">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">Fréquence</Label>
                <Select
                  value={p.recurrence_frequency ?? "weekly"}
                  onValueChange={(v) =>
                    onChange({ recurrence_frequency: v as PrestationDraft["recurrence_frequency"] })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Quotidienne</SelectItem>
                    <SelectItem value="weekly">Hebdomadaire</SelectItem>
                    <SelectItem value="monthly">Mensuelle</SelectItem>
                    <SelectItem value="yearly">Annuelle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px]">Intervalle</Label>
                <Input
                  type="number"
                  min="1"
                  value={p.recurrence_interval ?? 1}
                  onChange={(e) =>
                    onChange({ recurrence_interval: e.target.value ? Number(e.target.value) : 1 })
                  }
                />
                <p className="text-[9px] text-muted-foreground mt-0.5">
                  Toutes les {p.recurrence_interval ?? 1}{" "}
                  {p.recurrence_frequency === "daily"
                    ? "journée(s)"
                    : p.recurrence_frequency === "weekly"
                      ? "semaine(s)"
                      : p.recurrence_frequency === "monthly"
                        ? "mois"
                        : "année(s)"}
                </p>
              </div>
            </div>

            {/* Jours de la semaine — uniquement pour la fréquence hebdomadaire */}
            {p.recurrence_frequency === "weekly" && (
              <div>
                <Label className="text-[10px]">Jours de la semaine</Label>
                <div className="flex gap-1 mt-0.5">
                  {WEEKDAYS.map((d) => {
                    const on = activeDays.includes(d.code);
                    return (
                      <button
                        key={d.code}
                        type="button"
                        onClick={() => toggleDay(d.code)}
                        className={
                          "h-7 w-7 rounded-md border text-xs font-medium transition-colors " +
                          (on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input hover:bg-muted")
                        }
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Heure début
                </Label>
                <Input
                  type="time"
                  value={p.recurrence_start_time ?? ""}
                  onChange={(e) => onChange({ recurrence_start_time: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-[10px] flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Heure fin
                </Label>
                <Input
                  type="time"
                  value={p.recurrence_end_time ?? ""}
                  onChange={(e) => onChange({ recurrence_end_time: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label className="text-[10px]">Fin de la récurrence</Label>
              <Select
                value={p.recurrence_end_type ?? "never"}
                onValueChange={(v) =>
                  onChange({ recurrence_end_type: v as PrestationDraft["recurrence_end_type"] })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Jamais</SelectItem>
                  <SelectItem value="on_date">À une date</SelectItem>
                  <SelectItem value="after_occurrences">Après N occurrences</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {p.recurrence_end_type === "on_date" && (
              <div>
                <Label className="text-[10px]">Date de fin</Label>
                <Input
                  type="date"
                  value={p.end_date ?? ""}
                  min={p.start_date ?? undefined}
                  onChange={(e) => onChange({ end_date: e.target.value || null })}
                />
                <p className="text-[9px] text-muted-foreground mt-0.5">
                  La récurrence s'arrête à cette date (aussi date de fin de la prestation).
                </p>
              </div>
            )}

            {p.recurrence_end_type === "after_occurrences" && (
              <div>
                <Label className="text-[10px]">Nombre d'occurrences</Label>
                <Input
                  type="number"
                  min="1"
                  value={p.recurrence_occurrences_count ?? ""}
                  onChange={(e) =>
                    onChange({
                      recurrence_occurrences_count: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="Ex: 12"
                />
              </div>
            )}

            {/* ====== Intervenant par défaut des RDV générés ====== */}
            <div className="rounded-md border bg-muted/30 p-2.5 space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                <UserPlus className="h-3 w-3" />
                Intervenant des RDV récurrents
              </Label>
              {p.default_employee_id ? (
                <div className="flex items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-2 py-1.5">
                  <span className="text-xs font-medium text-primary truncate flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {p.default_employee_name ?? `Intervenant #${p.default_employee_id}`}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 text-rose-600 hover:text-rose-700"
                    title="Retirer l'intervenant — les RDV repasseront « à pourvoir »"
                    onClick={() =>
                      onChange({ default_employee_id: null, default_employee_name: null })
                    }
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  Aucun intervenant — les RDV générés seront « à pourvoir ».
                </p>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full h-7 gap-1 text-[11px]"
                disabled={!clientId}
                title={
                  clientId
                    ? "Choisir un intervenant via la carte de suggestion"
                    : "Client requis pour la suggestion d'intervenants"
                }
                onClick={() => setAssignOpen(true)}
              >
                <UserPlus className="h-3 w-3" />
                {p.default_employee_id ? "Changer d'intervenant" : "Assigner un intervenant"}
              </Button>
            </div>
          </div>
        )}

        {/* Date de fin (optionnelle) pour les ponctuelles */}
        {!isRecurring && (
          <div>
            <Label className="text-[10px]">Fin de prestation (optionnel)</Label>
            <Input
              type="date"
              value={p.end_date ?? ""}
              min={p.start_date ?? undefined}
              onChange={(e) => onChange({ end_date: e.target.value || null })}
            />
          </div>
        )}
      </div>

      {/* ====== Pop-up carte de suggestion d'intervenants ====== */}
      {clientId != null && (
        <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
          <DialogContent className="sm:!max-w-4xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary" />
                Assigner un intervenant
              </DialogTitle>
              <DialogDescription>
                Intervenants disponibles et proches du client pour le créneau{" "}
                {p.recurrence_start_time ?? "09:00"}–{p.recurrence_end_time ?? "11:00"}.
                Le choix devient l'intervenant par défaut des RDV récurrents générés.
              </DialogDescription>
            </DialogHeader>
            <AvailableEmployeesMap
              startDatetime={`${p.start_date || todayStr()}T${p.recurrence_start_time ?? "09:00"}:00`}
              endDatetime={`${p.start_date || todayStr()}T${p.recurrence_end_time ?? "11:00"}:00`}
              clientId={clientId}
              selectedEmployeeId={p.default_employee_id}
              onAssign={(employeeId, employeeName) => {
                onChange({
                  default_employee_id: employeeId,
                  default_employee_name: employeeName ?? `Intervenant #${employeeId}`,
                });
                setAssignOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
