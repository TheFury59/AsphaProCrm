import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useClients, useCreateServiceAssignment, useEmployees, useServices } from "@/hooks/use-planning";
import { apiErrorMessage } from "@/lib/api";
import { X } from "lucide-react";

const baseSchema = z.object({
  client_id: z.coerce.number().int().positive("Client requis"),
  client_address_id: z.coerce.number().int().positive("Adresse requise"),
  service_id: z.coerce.number().int().positive("Prestation requise"),
  default_employee_id: z.coerce.number().int().nullable().optional(),
  duration_minutes: z.coerce.number().int().min(15).max(1440),
  hourly_rate: z.coerce.number().min(0).nullable().optional(),
  notes: z.string().optional(),
});

const punctualSchema = baseSchema.extend({
  type: z.literal("punctual"),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduled_time: z.string().regex(/^\d{2}:\d{2}$/),
});

const recurringSchema = baseSchema.extend({
  type: z.literal("recurring"),
  recurrence_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recurrence_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  recurrence_time: z.string().regex(/^\d{2}:\d{2}$/),
  recurrence_days: z.array(z.string()).min(1, "Choisir au moins un jour"),
  recurrence_interval: z.coerce.number().int().min(1).max(12).default(1),
});

const schema = z.discriminatedUnion("type", [punctualSchema, recurringSchema]);
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

const DAYS = [
  { code: "MO", label: "Lun" },
  { code: "TU", label: "Mar" },
  { code: "WE", label: "Mer" },
  { code: "TH", label: "Jeu" },
  { code: "FR", label: "Ven" },
  { code: "SA", label: "Sam" },
  { code: "SU", label: "Dim" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  defaultDate?: Date;
};

export function CreateAppointmentDialog({ open, onClose, defaultDate }: Props) {
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: services = [] } = useServices();
  const { data: employees = [] } = useEmployees();
  const { data: clients = [] } = useClients();
  const createSA = useCreateServiceAssignment();

  const initialDate = (defaultDate ?? new Date()).toISOString().slice(0, 10);
  const initialTime = (defaultDate ?? new Date()).toTimeString().slice(0, 5);

  const { register, handleSubmit, watch, setValue, control, formState: { errors, isSubmitting }, reset } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    shouldUnregister: false,
    defaultValues: {
      type: "punctual",
      duration_minutes: 60,
      hourly_rate: null,
      scheduled_date: initialDate,
      scheduled_time: initialTime,
      recurrence_start: initialDate,
      recurrence_end: null,
      recurrence_time: initialTime,
      recurrence_days: ["MO"],
      recurrence_interval: 1,
    } as unknown as FormInput,
  });

  useEffect(() => {
    if (!open) {
      reset();
      setServerError(null);
    }
  }, [open, reset]);

  const type = watch("type");
  const clientId = watch("client_id");
  const serviceId = watch("service_id");
  const selectedClient = clients.find((c) => c.id === Number(clientId));
  const selectedService = services.find((s) => s.id === Number(serviceId));

  // Auto-pick default address + duration when client/service changes
  useEffect(() => {
    if (selectedClient) {
      const def = selectedClient.addresses.find((a) => a.is_default) ?? selectedClient.addresses[0];
      if (def) setValue("client_address_id", def.id);
    }
  }, [selectedClient, setValue]);

  useEffect(() => {
    if (selectedService) {
      setValue("duration_minutes", selectedService.default_duration_minutes);
    }
  }, [selectedService, setValue]);

  const onSubmit = async (values: FormOutput) => {
    setServerError(null);
    try {
      const payload = values.type === "punctual"
        ? {
            type: "punctual" as const,
            client_id: values.client_id,
            client_address_id: values.client_address_id,
            service_id: values.service_id,
            default_employee_id: values.default_employee_id ?? null,
            duration_minutes: values.duration_minutes,
            hourly_rate: values.hourly_rate ?? null,
            scheduled_date: values.scheduled_date,
            scheduled_time: values.scheduled_time,
            notes: values.notes,
          }
        : {
            type: "recurring" as const,
            client_id: values.client_id,
            client_address_id: values.client_address_id,
            service_id: values.service_id,
            default_employee_id: values.default_employee_id ?? null,
            duration_minutes: values.duration_minutes,
            hourly_rate: values.hourly_rate ?? null,
            recurrence_start: values.recurrence_start,
            recurrence_end: values.recurrence_end ?? null,
            recurrence_time: values.recurrence_time,
            recurrence_rule: buildRrule(values.recurrence_days, values.recurrence_interval),
            notes: values.notes,
          };
      await createSA.mutateAsync(payload);
      onClose();
    } catch (e) {
      setServerError(apiErrorMessage(e, "Création impossible"));
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-lg font-semibold">Nouvelle intervention</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          {/* Type */}
          <div className="flex gap-2">
            {(["punctual", "recurring"] as const).map((t) => (
              <label
                key={t}
                className={`flex-1 cursor-pointer rounded-md border px-3 py-2 text-center text-sm ${
                  type === t ? "border-primary bg-primary/5 font-medium" : "hover:bg-accent/50"
                }`}
              >
                <input type="radio" value={t} {...register("type")} className="sr-only" />
                {t === "punctual" ? "Ponctuel" : "Récurrent"}
              </label>
            ))}
          </div>

          {/* Client + adresse */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Client" error={errors.client_id?.message}>
              <select {...register("client_id")} className="input">
                <option value="">— Choisir —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.display_name}</option>
                ))}
              </select>
            </Field>
            <Field label="Adresse" error={errors.client_address_id?.message}>
              <select {...register("client_address_id")} className="input" disabled={!selectedClient}>
                <option value="">— Choisir —</option>
                {selectedClient?.addresses.map((a) => (
                  <option key={a.id} value={a.id}>{a.label} — {a.line1}, {a.city}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Service + intervenant */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prestation" error={errors.service_id?.message}>
              <select {...register("service_id")} className="input">
                <option value="">— Choisir —</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.default_duration_minutes} min)</option>
                ))}
              </select>
            </Field>
            <Field label="Intervenant (optionnel)">
              <select {...register("default_employee_id")} className="input">
                <option value="">Aucun (pool)</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.full_name}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Durée + tarif */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Durée (minutes)" error={errors.duration_minutes?.message}>
              <input type="number" min={15} max={1440} step={15} {...register("duration_minutes")} className="input" />
            </Field>
            <Field label={`Tarif horaire (défaut: ${selectedService?.default_hourly_rate ?? 0} €)`}>
              <input type="number" min={0} step={0.5} {...register("hourly_rate")} placeholder="Laisser vide pour défaut" className="input" />
            </Field>
          </div>

          {/* Date / heure selon type */}
          {type === "punctual" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" error={(errors as Record<string, { message?: string }>).scheduled_date?.message}>
                <input type="date" {...register("scheduled_date")} className="input" />
              </Field>
              <Field label="Heure" error={(errors as Record<string, { message?: string }>).scheduled_time?.message}>
                <input type="time" {...register("scheduled_time")} className="input" />
              </Field>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Date début" error={(errors as Record<string, { message?: string }>).recurrence_start?.message}>
                  <input type="date" {...register("recurrence_start")} className="input" />
                </Field>
                <Field label="Date fin (optionnelle)">
                  <input type="date" {...register("recurrence_end")} className="input" />
                </Field>
                <Field label="Heure" error={(errors as Record<string, { message?: string }>).recurrence_time?.message}>
                  <input type="time" {...register("recurrence_time")} className="input" />
                </Field>
              </div>
              <Field label="Jours de la semaine" error={(errors as Record<string, { message?: string }>).recurrence_days?.message}>
                <Controller
                  control={control}
                  name="recurrence_days"
                  render={({ field }) => (
                    <div className="flex flex-wrap gap-1">
                      {DAYS.map((d) => {
                        const selected = field.value?.includes(d.code);
                        return (
                          <button
                            type="button"
                            key={d.code}
                            onClick={() => {
                              const next = selected
                                ? field.value.filter((x: string) => x !== d.code)
                                : [...(field.value ?? []), d.code];
                              field.onChange(next);
                            }}
                            className={`px-2.5 py-1 rounded text-xs border ${
                              selected ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"
                            }`}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                />
              </Field>
              <Field label="Intervalle (toutes les N semaines)">
                <input type="number" min={1} max={12} {...register("recurrence_interval")} className="input w-24" />
              </Field>
            </>
          )}

          <Field label="Notes (optionnel)">
            <textarea {...register("notes")} rows={2} className="input" />
          </Field>

          {serverError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm hover:bg-accent">
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? "Création…" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-foreground/80">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function buildRrule(days: string[], interval: number): string {
  const parts = [`FREQ=WEEKLY`];
  if (interval > 1) parts.push(`INTERVAL=${interval}`);
  parts.push(`BYDAY=${days.join(",")}`);
  return parts.join(";");
}
