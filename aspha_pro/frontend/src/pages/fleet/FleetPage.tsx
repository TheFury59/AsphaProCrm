import { useState } from "react";
import { AlertTriangle, Car, Plus, ShieldCheck, Wrench } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAssignVehicle, useCreateIncident, useCreateMaintenance, useCreateVehicle,
  useFleetAlerts, useVehicle, useVehicles, type Vehicle,
} from "@/hooks/use-fleet";
import { apiErrorMessage } from "@/lib/api";

export function FleetPage() {
  const [search, setSearch] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [activeVehicleId, setActiveVehicleId] = useState<number | null>(null);
  const { data: vehicles, isLoading } = useVehicles({ "filter[search]": search || undefined, per_page: 50 });
  const { data: alerts } = useFleetAlerts();

  return (
    <div>
      <PageHeader
        title="Flotte véhicule"
        description="Véhicules, attributions, entretiens et sinistres."
        actions={
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Nouveau véhicule</Button>
            </DialogTrigger>
            <CreateVehicleDialog onClose={() => setOpenCreate(false)} />
          </Dialog>
        }
      />

      {alerts && (alerts.insurance_expiring.length > 0 || alerts.inspection_due.length > 0 || alerts.open_incidents > 0) && (
        <Card className="mb-4 border-orange-300 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              Alertes flotte
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 text-xs">
            {alerts.insurance_expiring.length > 0 && (
              <Badge variant="outline" className="border-orange-400">
                <ShieldCheck className="h-3 w-3 mr-1" />
                {alerts.insurance_expiring.length} assurance(s) à renouveler &lt; 30j
              </Badge>
            )}
            {alerts.inspection_due.length > 0 && (
              <Badge variant="outline" className="border-orange-400">
                <Wrench className="h-3 w-3 mr-1" />
                {alerts.inspection_due.length} CT à passer &lt; 30j
              </Badge>
            )}
            {alerts.open_incidents > 0 && (
              <Badge variant="destructive">
                {alerts.open_incidents} sinistre(s) en cours
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      <div className="mb-4">
        <Input placeholder="Rechercher (plaque, marque, modèle)…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plaque</TableHead>
                  <TableHead>Marque / Modèle</TableHead>
                  <TableHead>Carburant</TableHead>
                  <TableHead className="text-right">Km</TableHead>
                  <TableHead>Attribué à</TableHead>
                  <TableHead>CT</TableHead>
                  <TableHead>Assurance</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles?.data?.map((v) => {
                  const ctSoon = v.next_inspection_at && new Date(v.next_inspection_at) <= new Date(Date.now() + 30 * 86400000);
                  const insSoon = v.insurance_expires_at && new Date(v.insurance_expires_at) <= new Date(Date.now() + 30 * 86400000);
                  return (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono text-xs">{v.license_plate}</TableCell>
                      <TableCell>{v.brand} {v.model} {v.year && `(${v.year})`}</TableCell>
                      <TableCell className="text-xs">{v.fuel_type ?? "—"}</TableCell>
                      <TableCell className="text-right text-sm">{v.current_mileage.toLocaleString("fr-FR")}</TableCell>
                      <TableCell className="text-sm">{v.current_assignment?.employee?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-xs">
                        {v.next_inspection_at ? (
                          <span className={ctSoon ? "text-orange-600 font-medium" : ""}>
                            {format(new Date(v.next_inspection_at), "dd/MM/yy")}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {v.insurance_expires_at ? (
                          <span className={insSoon ? "text-orange-600 font-medium" : ""}>
                            {format(new Date(v.insurance_expires_at), "dd/MM/yy")}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell><Badge variant={v.status === "active" ? "default" : "secondary"}>{v.status}</Badge></TableCell>
                      <TableCell><Button size="sm" variant="ghost" onClick={() => setActiveVehicleId(v.id)}>Détail</Button></TableCell>
                    </TableRow>
                  );
                })}
                {vehicles?.data?.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-12">Aucun véhicule.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!activeVehicleId} onOpenChange={(o) => !o && setActiveVehicleId(null)}>
        {activeVehicleId && <VehicleDetailDialog vehicleId={activeVehicleId} onClose={() => setActiveVehicleId(null)} />}
      </Dialog>
    </div>
  );
}

function CreateVehicleDialog({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    license_plate: "",
    brand: "",
    model: "",
    year: new Date().getFullYear(),
    fuel_type: "gasoline" as const,
    current_mileage: 0,
    insurance_expires_at: "",
    next_inspection_at: "",
  });
  const create = useCreateVehicle();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(form as any, {
      onSuccess: () => { toast.success("Véhicule ajouté"); onClose(); },
      onError: (e) => toast.error(apiErrorMessage(e)),
    });
  };

  return (
    <DialogContent>
      <form onSubmit={submit}>
        <DialogHeader>
          <DialogTitle>Nouveau véhicule</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-4">
          <div className="grid gap-1"><Label>Immatriculation *</Label>
            <Input required value={form.license_plate} onChange={(e) => setForm({ ...form, license_plate: e.target.value.toUpperCase() })} placeholder="AB-123-CD" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1"><Label>Marque</Label><Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></div>
            <div className="grid gap-1"><Label>Modèle</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="grid gap-1"><Label>Année</Label>
              <Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: +e.target.value })} /></div>
            <div className="grid gap-1"><Label>Carburant</Label>
              <Select value={form.fuel_type} onValueChange={(v) => setForm({ ...form, fuel_type: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gasoline">Essence</SelectItem>
                  <SelectItem value="diesel">Diesel</SelectItem>
                  <SelectItem value="electric">Électrique</SelectItem>
                  <SelectItem value="hybrid">Hybride</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1"><Label>Km</Label>
              <Input type="number" min={0} value={form.current_mileage} onChange={(e) => setForm({ ...form, current_mileage: +e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1"><Label>Échéance assurance</Label>
              <Input type="date" value={form.insurance_expires_at} onChange={(e) => setForm({ ...form, insurance_expires_at: e.target.value })} /></div>
            <div className="grid gap-1"><Label>Prochain CT</Label>
              <Input type="date" value={form.next_inspection_at} onChange={(e) => setForm({ ...form, next_inspection_at: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={create.isPending}>{create.isPending ? "…" : "Créer"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function VehicleDetailDialog({ vehicleId, onClose }: { vehicleId: number; onClose: () => void }) {
  const { data: v, isLoading } = useVehicle(vehicleId);
  const assign = useAssignVehicle();
  const createMaint = useCreateMaintenance();
  const createInc = useCreateIncident();
  const [empId, setEmpId] = useState("");

  if (isLoading || !v) {
    return <DialogContent><div className="p-6 text-sm text-muted-foreground">Chargement…</div></DialogContent>;
  }

  const doAssign = () => {
    if (!empId) return;
    assign.mutate(
      { vehicleId, payload: { employee_id: +empId, start_date: new Date().toISOString().slice(0, 10), start_mileage: v.current_mileage } },
      {
        onSuccess: () => { toast.success("Véhicule attribué"); setEmpId(""); },
        onError: (e) => toast.error(apiErrorMessage(e)),
      },
    );
  };

  return (
    <DialogContent className="max-w-3xl">
      <DialogHeader>
        <DialogTitle>
          <Car className="inline mr-2 h-4 w-4" />
          {v.license_plate} — {v.brand} {v.model}
        </DialogTitle>
        <DialogDescription>{v.current_mileage.toLocaleString("fr-FR")} km · {v.fuel_type}</DialogDescription>
      </DialogHeader>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Infos</TabsTrigger>
          <TabsTrigger value="assignments">Attributions</TabsTrigger>
          <TabsTrigger value="maintenances">Entretiens ({v.maintenances?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="incidents">Sinistres ({v.incidents?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-2 text-sm mt-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div><span className="text-muted-foreground">Année :</span> {v.year ?? "—"}</div>
            <div><span className="text-muted-foreground">Achat :</span> {v.purchase_date ?? "—"}</div>
            <div><span className="text-muted-foreground">Assurance :</span> {v.insurance_expires_at ?? "—"}</div>
            <div><span className="text-muted-foreground">CT :</span> {v.next_inspection_at ?? "—"}</div>
          </div>
          {v.notes && <p className="text-xs text-muted-foreground mt-2">{v.notes}</p>}
        </TabsContent>

        <TabsContent value="assignments" className="mt-4 space-y-3">
          <div className="flex gap-2 items-end">
            <div className="grid gap-1 flex-1">
              <Label>Attribuer à employee_id</Label>
              <Input type="number" value={empId} onChange={(e) => setEmpId(e.target.value)} />
            </div>
            <Button onClick={doAssign} disabled={!empId || assign.isPending}>Attribuer</Button>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Intervenant</TableHead><TableHead>Du</TableHead><TableHead>Au</TableHead>
              <TableHead className="text-right">Km début/fin</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {v.assignments?.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell>{a.employee?.name}</TableCell>
                  <TableCell className="text-xs">{format(new Date(a.start_date), "dd/MM/yy")}</TableCell>
                  <TableCell className="text-xs">{a.end_date ? format(new Date(a.end_date), "dd/MM/yy") : <Badge variant="default">en cours</Badge>}</TableCell>
                  <TableCell className="text-right text-xs">{a.start_mileage} / {a.end_mileage ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="maintenances" className="mt-4">
          <MaintenanceForm vehicleId={vehicleId} onDone={() => {}} />
          <Table className="mt-3">
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Type</TableHead>
              <TableHead className="text-right">Km</TableHead><TableHead className="text-right">Coût</TableHead>
              <TableHead>Prestataire</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {v.maintenances?.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs">{format(new Date(m.performed_at), "dd/MM/yy")}</TableCell>
                  <TableCell><Badge variant="outline">{m.type}</Badge></TableCell>
                  <TableCell className="text-right text-xs">{m.mileage ?? "—"}</TableCell>
                  <TableCell className="text-right text-xs">{m.cost ? `${m.cost} €` : "—"}</TableCell>
                  <TableCell className="text-xs">{m.provider ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="incidents" className="mt-4">
          <IncidentForm vehicleId={vehicleId} onDone={() => {}} />
          <Table className="mt-3">
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Sévérité</TableHead>
              <TableHead>Description</TableHead><TableHead>Statut</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {v.incidents?.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="text-xs">{format(new Date(i.incident_at), "dd/MM/yy")}</TableCell>
                  <TableCell><Badge variant="outline">{i.type}</Badge></TableCell>
                  <TableCell><Badge variant={i.severity === "major" ? "destructive" : "secondary"}>{i.severity}</Badge></TableCell>
                  <TableCell className="text-xs max-w-xs truncate">{i.description}</TableCell>
                  <TableCell><Badge>{i.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Fermer</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function MaintenanceForm({ vehicleId, onDone }: { vehicleId: number; onDone: () => void }) {
  const create = useCreateMaintenance();
  const [form, setForm] = useState({
    type: "revision",
    performed_at: new Date().toISOString().slice(0, 10),
    mileage: 0,
    cost: 0,
    provider: "",
    description: "",
    next_due_at: "",
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate({ vehicleId, payload: form }, {
      onSuccess: () => { toast.success("Entretien enregistré"); onDone(); setForm({ ...form, description: "", cost: 0 }); },
      onError: (e) => toast.error(apiErrorMessage(e)),
    });
  };
  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-2 mb-3 border-b pb-3">
      <div className="grid gap-1"><Label>Type</Label>
        <select className="rounded-md border bg-background px-2 py-1.5 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="revision">Révision</option>
          <option value="inspection">Contrôle technique</option>
          <option value="tire">Pneus</option>
          <option value="oil_change">Vidange</option>
          <option value="repair">Réparation</option>
          <option value="other">Autre</option>
        </select>
      </div>
      <div className="grid gap-1"><Label>Date</Label><Input type="date" required value={form.performed_at} onChange={(e) => setForm({ ...form, performed_at: e.target.value })} /></div>
      <div className="grid gap-1"><Label>Km</Label><Input type="number" min={0} value={form.mileage} onChange={(e) => setForm({ ...form, mileage: +e.target.value })} /></div>
      <div className="grid gap-1"><Label>Coût €</Label><Input type="number" min={0} step={0.01} value={form.cost} onChange={(e) => setForm({ ...form, cost: +e.target.value })} /></div>
      <div className="grid gap-1 col-span-2"><Label>Prestataire</Label><Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} /></div>
      <div className="col-span-2 flex justify-end"><Button type="submit" size="sm" disabled={create.isPending}>Ajouter entretien</Button></div>
    </form>
  );
}

function IncidentForm({ vehicleId, onDone }: { vehicleId: number; onDone: () => void }) {
  const create = useCreateIncident();
  const [form, setForm] = useState({
    incident_at: new Date().toISOString().slice(0, 10),
    type: "accident",
    severity: "minor",
    description: "",
    repair_cost: 0,
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate({ vehicleId, payload: form }, {
      onSuccess: () => { toast.success("Sinistre enregistré"); onDone(); setForm({ ...form, description: "" }); },
      onError: (e) => toast.error(apiErrorMessage(e)),
    });
  };
  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-2 mb-3 border-b pb-3">
      <div className="grid gap-1"><Label>Date</Label><Input type="date" required value={form.incident_at} onChange={(e) => setForm({ ...form, incident_at: e.target.value })} /></div>
      <div className="grid gap-1"><Label>Type</Label>
        <select className="rounded-md border bg-background px-2 py-1.5 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="accident">Accident</option>
          <option value="breakdown">Panne</option>
          <option value="theft">Vol</option>
          <option value="vandalism">Vandalisme</option>
          <option value="other">Autre</option>
        </select>
      </div>
      <div className="grid gap-1"><Label>Sévérité</Label>
        <select className="rounded-md border bg-background px-2 py-1.5 text-sm" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
          <option value="minor">Mineur</option>
          <option value="moderate">Modéré</option>
          <option value="major">Majeur</option>
        </select>
      </div>
      <div className="grid gap-1"><Label>Coût €</Label><Input type="number" min={0} step={0.01} value={form.repair_cost} onChange={(e) => setForm({ ...form, repair_cost: +e.target.value })} /></div>
      <div className="grid gap-1 col-span-2"><Label>Description *</Label><Textarea required rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <div className="col-span-2 flex justify-end"><Button type="submit" size="sm" variant="destructive" disabled={create.isPending}>Ajouter sinistre</Button></div>
    </form>
  );
}
