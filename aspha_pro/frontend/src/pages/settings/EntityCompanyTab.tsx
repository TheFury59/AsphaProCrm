import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, Loader2, Save, MapPin, FileText, Phone, Mail } from "lucide-react";
import { useEntityCompanies, useUpdateEntityCompany, type EntityCompany } from "@/hooks/use-entity-company";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiErrorMessage } from "@/lib/api";

/**
 * Onglet « Mon entreprise » dans les Paramètres admin.
 *
 * Permet à l'admin de renseigner les informations de l'entité (agence) :
 * raison sociale, contact, adresse, SIRET, n° TVA intracommunautaire,
 * coordonnées GPS. Ces données alimentent l'en-tête des PDF (devis,
 * factures) et la carte intervenants.
 *
 * Si plusieurs entités existent, on liste chacune sous forme de carte
 * éditable. Cas usuel V1 : une seule entité « Aspha Pro ».
 */
export function EntityCompanyTab() {
  const { data: entities, isLoading } = useEntityCompanies();

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!entities || entities.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Aucune entité enregistrée.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {entities.map((entity) => (
        <EntityCard key={entity.id} entity={entity} />
      ))}
    </div>
  );
}

function EntityCard({ entity }: { entity: EntityCompany }) {
  const update = useUpdateEntityCompany();

  // L'état local part des valeurs serveur et n'est réinitialisé que si l'ID
  // de l'entité change (ex. plusieurs entités, on bascule entre cartes).
  const [form, setForm] = useState({
    name: entity.name ?? "",
    phone: entity.phone ?? "",
    email: entity.email ?? "",
    siret: entity.siret ?? "",
    vat_number: entity.vat_number ?? "",
    address_line: entity.address_line ?? "",
    postal_code: entity.postal_code ?? "",
    city: entity.city ?? "",
    latitude: entity.latitude != null ? String(entity.latitude) : "",
    longitude: entity.longitude != null ? String(entity.longitude) : "",
    status: entity.status,
  });

  // Si le serveur renvoie de nouvelles valeurs (après save), on resync.
  useEffect(() => {
    setForm({
      name: entity.name ?? "",
      phone: entity.phone ?? "",
      email: entity.email ?? "",
      siret: entity.siret ?? "",
      vat_number: entity.vat_number ?? "",
      address_line: entity.address_line ?? "",
      postal_code: entity.postal_code ?? "",
      city: entity.city ?? "",
      latitude: entity.latitude != null ? String(entity.latitude) : "",
      longitude: entity.longitude != null ? String(entity.longitude) : "",
      status: entity.status,
    });
  }, [entity.id, entity.updated_at]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    // Validation au clic (cf. convention projet) — pas de submit disabled.
    if (!form.name.trim()) {
      toast.error("Le nom de l'entreprise est requis.");
      return;
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error("L'adresse email n'est pas valide.");
      return;
    }
    const lat = form.latitude.trim() === "" ? null : Number(form.latitude);
    const lng = form.longitude.trim() === "" ? null : Number(form.longitude);
    if (lat !== null && (isNaN(lat) || lat < -90 || lat > 90)) {
      toast.error("Latitude invalide (doit être entre -90 et 90).");
      return;
    }
    if (lng !== null && (isNaN(lng) || lng < -180 || lng > 180)) {
      toast.error("Longitude invalide (doit être entre -180 et 180).");
      return;
    }

    try {
      await update.mutateAsync({
        id: entity.id,
        patch: {
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          siret: form.siret.trim() || null,
          vat_number: form.vat_number.trim() || null,
          address_line: form.address_line.trim() || null,
          postal_code: form.postal_code.trim() || null,
          city: form.city.trim() || null,
          latitude: lat,
          longitude: lng,
          status: form.status,
        },
      });
      toast.success("Informations entreprise enregistrées.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Échec de l'enregistrement."));
      console.error("Update entity échoué", err);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          {entity.name || "Sans nom"}
        </CardTitle>
        <CardDescription>
          Ces informations apparaissent en en-tête des devis et factures PDF, et sur la carte des intervenants.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Identité */}
        <section className="space-y-3">
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Identité</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Raison sociale *</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Aspha Pro" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Statut</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v as "active" | "inactive")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="space-y-3">
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Contact</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" />Téléphone</Label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="03 00 00 00 00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" />Email</Label>
              <Input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="contact@asphapro-erp.fr" />
            </div>
          </div>
        </section>

        {/* Adresse */}
        <section className="space-y-3">
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1">
            <MapPin className="h-3 w-3" />Adresse
          </h3>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Rue</Label>
              <Input value={form.address_line} onChange={(e) => set("address_line", e.target.value)} placeholder="233 rue Morel" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Code postal</Label>
                <Input value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} placeholder="59500" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Ville</Label>
                <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Douai" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Latitude (carte)</Label>
                <Input value={form.latitude} onChange={(e) => set("latitude", e.target.value)} placeholder="50.3714" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Longitude (carte)</Label>
                <Input value={form.longitude} onChange={(e) => set("longitude", e.target.value)} placeholder="3.0800" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Les coordonnées GPS permettent de centrer la carte des intervenants sur le bon emplacement.
              Tu peux les récupérer sur Google Maps en faisant clic-droit sur l'adresse.
            </p>
          </div>
        </section>

        {/* Légal */}
        <section className="space-y-3">
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1">
            <FileText className="h-3 w-3" />Informations légales (en-tête PDF)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">SIRET</Label>
              <Input value={form.siret} onChange={(e) => set("siret", e.target.value)} placeholder="123 456 789 00012" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">N° TVA intracommunautaire</Label>
              <Input value={form.vat_number} onChange={(e) => set("vat_number", e.target.value)} placeholder="FR00123456789" />
            </div>
          </div>
        </section>

        <div className="flex justify-end pt-2 border-t">
          <Button
            type="button"
            onClick={handleSave}
            disabled={update.isPending}
            className="bg-gradient-aspha shadow-brand text-white border-0 hover:opacity-90 cursor-pointer"
          >
            {update.isPending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1.5" />
            )}
            Enregistrer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
