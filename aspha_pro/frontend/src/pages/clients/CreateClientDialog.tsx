import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { useCreateClient } from "@/hooks/use-clients";
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

const schema = z.object({
  // `code` n'est plus saisi : le backend l'attribue automatiquement (CLI-XXXX).
  entity_id: z.coerce.number().int().positive("Sélectionnez une entité"),
  status: z.enum(["active", "inactive", "suspended"]).default("active"),
  company: z.object({
    company_name: z.string().min(1, "Nom de l'entreprise requis"),
    siret: z.string().optional(),
    legal_form: z.string().optional(),
    manager_first_name: z.string().optional(),
    manager_last_name: z.string().optional(),
    primary_email: z.string().email("Email invalide").or(z.literal("")).optional(),
    phone_landline: z.string().optional(),
  }),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CreateClientDialog({ open, onClose }: Props) {
  const [serverError, setServerError] = useState<string | null>(null);
  const navigate = useNavigate();
  const create = useCreateClient();
  const { data: entities } = useEntities();

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, setValue, watch } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      entity_id: undefined,
      status: "active",
      company: { company_name: "" },
    } as unknown as FormInput,
  });

  const entityId = watch("entity_id");

  // Pré-sélection intelligente : s'il n'existe qu'une seule entité, on la
  // sélectionne automatiquement (cas courant d'une PME mono-agence).
  useEffect(() => {
    if (entities && entities.length === 1 && !entityId) {
      setValue("entity_id", entities[0].id as unknown as FormInput["entity_id"]);
    }
  }, [entities, entityId, setValue]);

  const onSubmit = async (values: FormOutput) => {
    setServerError(null);
    try {
      const client = await create.mutateAsync(values as any);
      reset();
      onClose();
      navigate(`/clients/${client.id}`);
    } catch (e) {
      setServerError(apiErrorMessage(e, "Création impossible"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau client</DialogTitle>
          <DialogDescription>
            Informations minimales pour créer la fiche. Les autres détails se complètent depuis la fiche.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="company.company_name">Raison sociale *</Label>
            <Input id="company.company_name" {...register("company.company_name")} placeholder="Société Dupont SAS" />
            {errors.company?.company_name && <p className="text-xs text-destructive">{errors.company.company_name.message}</p>}
          </div>

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
            <p className="text-xs text-muted-foreground">Agence / société de rattachement.</p>
            {errors.entity_id && <p className="text-xs text-destructive">{errors.entity_id.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="company.siret">SIRET</Label>
              <Input id="company.siret" {...register("company.siret")} placeholder="14 chiffres" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company.legal_form">Forme juridique</Label>
              <Input id="company.legal_form" {...register("company.legal_form")} placeholder="SAS, SARL, EI…" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="company.manager_first_name">Prénom gérant</Label>
              <Input id="company.manager_first_name" {...register("company.manager_first_name")} placeholder="Jean" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company.manager_last_name">Nom gérant</Label>
              <Input id="company.manager_last_name" {...register("company.manager_last_name")} placeholder="Dupont" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="company.primary_email">Email prioritaire</Label>
              <Input id="company.primary_email" type="email" {...register("company.primary_email")} placeholder="contact@societe.fr" />
              {errors.company?.primary_email && <p className="text-xs text-destructive">{errors.company.primary_email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company.phone_landline">Téléphone</Label>
              <Input id="company.phone_landline" {...register("company.phone_landline")} placeholder="01 23 45 67 89" />
            </div>
          </div>

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
