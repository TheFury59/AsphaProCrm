import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { useCreateEmployee } from "@/hooks/use-employees";
import { useEntities } from "@/hooks/use-products";
import { apiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const schema = z.object({
  entity_id: z.coerce.number().int().positive("Sélectionnez une entité"),
  name: z.string().min(1, "Nom requis"),
  phone: z.string().optional(),
  classification: z.enum(["non_cadre", "cadre"]).default("non_cadre"),
  transport_mode: z.string().optional(),
  has_company_vehicle: z.boolean().default(false),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CreateEmployeeDialog({ open, onClose }: Props) {
  const [serverError, setServerError] = useState<string | null>(null);
  const navigate = useNavigate();
  const create = useCreateEmployee();
  const { data: entities } = useEntities();

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, setValue, watch } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      entity_id: undefined,
      name: "",
      classification: "non_cadre",
      has_company_vehicle: false,
    } as unknown as FormInput,
  });

  const hasVehicle = watch("has_company_vehicle");
  const entityId = watch("entity_id");

  // Pré-sélection intelligente : une seule entité → sélection automatique.
  useEffect(() => {
    if (entities && entities.length === 1 && !entityId) {
      setValue("entity_id", entities[0].id as unknown as FormInput["entity_id"]);
    }
  }, [entities, entityId, setValue]);

  const onSubmit = async (values: FormOutput) => {
    setServerError(null);
    try {
      const emp = await create.mutateAsync(values as any);
      reset();
      onClose();
      navigate(`/intervenants/${emp.id}`);
    } catch (e) {
      setServerError(apiErrorMessage(e, "Création impossible"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvel intervenant</DialogTitle>
          <DialogDescription>
            Le contrat, les compétences et les documents se complètent depuis la fiche.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nom complet *</Label>
            <Input id="name" {...register("name")} placeholder="Sophie Martin" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="entity_id">Entité *</Label>
              <Select
                value={entityId ? String(entityId) : ""}
                onValueChange={(v) => setValue("entity_id", Number(v) as unknown as FormInput["entity_id"], { shouldValidate: true })}
              >
                <SelectTrigger id="entity_id">
                  <SelectValue placeholder="Sélectionner une entité…" />
                </SelectTrigger>
                <SelectContent>
                  {entities?.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.entity_id && <p className="text-xs text-destructive">{errors.entity_id.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Téléphone</Label>
              <Input id="phone" {...register("phone")} placeholder="06 12 34 56 78" />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">Entité : agence / société de rattachement.</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="classification">Classification *</Label>
              <select id="classification" {...register("classification")} className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9">
                <option value="non_cadre">Non-cadre</option>
                <option value="cadre">Cadre</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="transport_mode">Mode de déplacement</Label>
              <Input id="transport_mode" {...register("transport_mode")} placeholder="Voiture, vélo, transports…" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={hasVehicle} onCheckedChange={(v) => setValue("has_company_vehicle", !!v)} />
            Véhicule de service à plein temps (jamais véhicule personnel)
          </label>

          {serverError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Création…" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
