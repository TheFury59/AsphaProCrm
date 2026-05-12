import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { useCreateClient } from "@/hooks/use-clients";
import { apiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const schema = z.object({
  code: z.string().min(1, "Code requis"),
  entity_id: z.coerce.number().int().positive(),
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

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: "",
      entity_id: 1,
      status: "active",
      company: { company_name: "" },
    } as unknown as FormInput,
  });

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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="code">Code *</Label>
              <Input id="code" {...register("code")} placeholder="CLI-001" />
              {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="entity_id">Entité *</Label>
              <Input id="entity_id" type="number" {...register("entity_id")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="company.company_name">Raison sociale *</Label>
            <Input id="company.company_name" {...register("company.company_name")} placeholder="Société Dupont SAS" />
            {errors.company?.company_name && <p className="text-xs text-destructive">{errors.company.company_name.message}</p>}
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
              <Input id="company.manager_first_name" {...register("company.manager_first_name")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company.manager_last_name">Nom gérant</Label>
              <Input id="company.manager_last_name" {...register("company.manager_last_name")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="company.primary_email">Email prioritaire</Label>
              <Input id="company.primary_email" type="email" {...register("company.primary_email")} />
              {errors.company?.primary_email && <p className="text-xs text-destructive">{errors.company.primary_email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company.phone_landline">Téléphone</Label>
              <Input id="company.phone_landline" {...register("company.phone_landline")} />
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
