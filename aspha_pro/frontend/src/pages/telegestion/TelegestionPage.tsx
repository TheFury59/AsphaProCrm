import { useMemo, useState } from "react";
import { Plus, QrCode, RefreshCw, ScanLine } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useCheckinLogs,
  useGenerateQrCode,
  useManualEntry,
  useQrCodes,
} from "@/hooks/use-operations";
import { useEmployees } from "@/hooks/use-employees";
import { api, apiErrorMessage } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export function TelegestionPage() {
  return (
    <div>
      <PageHeader
        title="Télégestion"
        description="QR codes par adresse, badgeages et saisies manuelles admin."
      />

      <Tabs defaultValue="qr">
        <TabsList>
          <TabsTrigger value="qr"><QrCode className="mr-2 h-3 w-3" />QR Codes</TabsTrigger>
          <TabsTrigger value="logs"><ScanLine className="mr-2 h-3 w-3" />Journal</TabsTrigger>
          <TabsTrigger value="manual"><Plus className="mr-2 h-3 w-3" />Saisie manuelle</TabsTrigger>
        </TabsList>

        <TabsContent value="qr" className="mt-4">
          <QrCodesTab />
        </TabsContent>
        <TabsContent value="logs" className="mt-4">
          <LogsTab />
        </TabsContent>
        <TabsContent value="manual" className="mt-4">
          <ManualEntryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function QrCodesTab() {
  const { data, isLoading } = useQrCodes();
  const generate = useGenerateQrCode();
  const [openCreate, setOpenCreate] = useState(false);
  const [addressId, setAddressId] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>(""); // audit 2026-05-19

  const create = () => {
    if (!addressId) {
      toast.error("Address ID requis");
      return;
    }
    const payload: { address_id: number; expires_at?: string | null } = {
      address_id: +addressId,
    };
    if (expiresAt) payload.expires_at = expiresAt + ":00"; // audit 2026-05-19
    generate.mutate(payload, {
      onSuccess: (qr) => {
        toast.success(`QR généré : ${qr.code}`);
        setOpenCreate(false);
        setAddressId("");
        setExpiresAt("");
      },
      onError: (e) => toast.error(apiErrorMessage(e)),
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">QR codes actifs</CardTitle>
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-3 w-3" />Générer</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Générer un QR code</DialogTitle>
              <DialogDescription>
                Lie le QR à une adresse client. Le QR sert au badgeage arrivée/départ sur place.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid gap-1">
                <Label>Address ID *</Label>
                <Input
                  type="number"
                  value={addressId}
                  onChange={(e) => setAddressId(e.target.value)}
                  placeholder="ID de l'adresse client"
                />
              </div>
              <div className="grid gap-1">
                <Label>Expiration (optionnel)</Label>
                <Input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Si renseigné, le QR sera refusé après cette date (HTTP 410).
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" onClick={create} disabled={generate.isPending}>
                {generate.isPending ? "…" : "Générer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Adresse</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Expire</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-mono text-xs">{q.code}</TableCell>
                  <TableCell>{q.address_id ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={q.status === "valid" ? "default" : "secondary"}>{q.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {q.expires_at
                      ? format(new Date(q.expires_at), "dd/MM/yy HH:mm", { locale: fr })
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                    Aucun QR code généré.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function LogsTab() {
  const { data, isLoading } = useCheckinLogs({ per_page: 100 });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Journal des badgeages</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date/Heure</TableHead>
                <TableHead>Événement</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Intervenant</TableHead>
                <TableHead>Intervention</TableHead>
                <TableHead>Commentaire</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.map((l) => (
                <TableRow key={l.id}>
                  {/* audit 2026-05-19 — lecture `called_at` + format FR */}
                  <TableCell className="text-xs">
                    {l.called_at
                      ? format(new Date(l.called_at), "dd/MM/yy HH:mm:ss", { locale: fr })
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {/* audit 2026-05-19 — event_type arrival/departure */}
                    {l.event_type === "arrival" && (
                      <Badge variant="default">Arrivée</Badge>
                    )}
                    {l.event_type === "departure" && (
                      <Badge variant="outline">Départ</Badge>
                    )}
                    {l.event_type === "unrecognized" && (
                      <Badge variant="destructive">Inconnu</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {/* audit 2026-05-19 — origin mobile/manual */}
                    {l.origin === "mobile" && (
                      <Badge variant="secondary" className="text-xs">Mobile</Badge>
                    )}
                    {l.origin === "manual" && (
                      <Badge variant="outline" className="text-xs">Manuel</Badge>
                    )}
                    {l.origin === "landline" && (
                      <Badge variant="outline" className="text-xs">Fixe</Badge>
                    )}
                    {!l.origin && <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-xs">
                    {l.employee?.name ?? `#${l.employee_id}`}
                  </TableCell>
                  <TableCell className="text-xs">{l.intervention_id ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">
                    {l.comment ?? ""}
                  </TableCell>
                </TableRow>
              ))}
              {data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                    Aucun badgeage enregistré.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * audit 2026-05-19 — fetch léger des interventions récentes pour le picker.
 * Le hook `useInterventions` historique est réservé au feed FullCalendar
 * (params from/to), pas adapté ici. On va sur l'endpoint REST standard.
 */
function useInterventionsList() {
  return useQuery({
    queryKey: ["interventions", "manual-entry-picker"],
    queryFn: async () => {
      const { data } = await api.get<{
        data: { data: Array<{
          id: number;
          start_datetime: string | null;
          status: string | null;
          employee?: { id: number; name: string } | null;
          client?: { id: number; code: string } | null;
        }> };
      }>("/interventions?sort=-start_datetime&per_page=100");
      return data.data.data;
    },
    staleTime: 30_000,
  });
}

function ManualEntryTab() {
  const { data: employees } = useEmployees({ per_page: 200 });
  const { data: interventions } = useInterventionsList();

  const [form, setForm] = useState({
    employee_id: "",
    intervention_id: "",
    checkin_time: new Date().toISOString().slice(0, 16),
    checkout_time: "",
    comment: "",
  });
  const manual = useManualEntry();

  // audit 2026-05-19 — quand on choisit une intervention, on prend par
  // défaut l'intervenant qui lui est rattaché (si présent).
  const handleInterventionChange = (val: string) => {
    const iv = interventions?.find((i) => String(i.id) === val);
    setForm((f) => ({
      ...f,
      intervention_id: val,
      employee_id: iv?.employee?.id ? String(iv.employee.id) : f.employee_id,
    }));
  };

  const employeeOptions = useMemo(
    () => employees?.data ?? [],
    [employees],
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employee_id || !form.intervention_id) {
      toast.error("Intervenant et intervention requis");
      return;
    }
    if (!form.checkin_time && !form.checkout_time) {
      toast.error("Renseigne au moins une date (arrivée ou départ)");
      return;
    }

    manual.mutate(
      {
        employee_id: +form.employee_id,
        intervention_id: +form.intervention_id,
        // audit 2026-05-19 — pas de Z final (cf. lessons 2026-05-13 timezone)
        checkin_time: form.checkin_time ? form.checkin_time + ":00" : null,
        checkout_time: form.checkout_time ? form.checkout_time + ":00" : null,
        comment: form.comment || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Saisie manuelle enregistrée");
          setForm({
            employee_id: "",
            intervention_id: "",
            checkin_time: new Date().toISOString().slice(0, 16),
            checkout_time: "",
            comment: "",
          });
        },
        onError: (e) => {
          toast.error(apiErrorMessage(e));
          console.error("manualEntry failed", e);
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Saisie manuelle (oubli de badgeage)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3 max-w-xl">
          {/* audit 2026-05-19 — picker intervention (sélecteur) */}
          <div className="grid gap-1">
            <Label>Intervention *</Label>
            <Select
              value={form.intervention_id}
              onValueChange={handleInterventionChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir une intervention…" />
              </SelectTrigger>
              <SelectContent>
                {interventions?.map((iv) => (
                  <SelectItem key={iv.id} value={String(iv.id)}>
                    #{iv.id} · {iv.client?.code ?? "—"} ·{" "}
                    {iv.start_datetime
                      ? format(new Date(iv.start_datetime), "dd/MM/yy HH:mm", { locale: fr })
                      : "sans date"}
                    {iv.employee?.name ? ` · ${iv.employee.name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* audit 2026-05-19 — picker intervenant */}
          <div className="grid gap-1">
            <Label>Intervenant *</Label>
            <Select
              value={form.employee_id}
              onValueChange={(val) => setForm({ ...form, employee_id: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir un intervenant…" />
              </SelectTrigger>
              <SelectContent>
                {employeeOptions.map((emp) => (
                  <SelectItem key={emp.id} value={String(emp.id)}>
                    {emp.full_name ?? emp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* audit 2026-05-19 — checkin_time + checkout_time séparés */}
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label>Arrivée</Label>
              <Input
                type="datetime-local"
                value={form.checkin_time}
                onChange={(e) => setForm({ ...form, checkin_time: e.target.value })}
              />
            </div>
            <div className="grid gap-1">
              <Label>Départ</Label>
              <Input
                type="datetime-local"
                value={form.checkout_time}
                onChange={(e) => setForm({ ...form, checkout_time: e.target.value })}
              />
            </div>
          </div>

          {/* audit 2026-05-19 — comment (textarea) au lieu de reason */}
          <div className="grid gap-1">
            <Label>Commentaire</Label>
            <Textarea
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
              placeholder="Ex : oubli de badge, problème réseau…"
              rows={3}
            />
          </div>

          <Button type="submit" disabled={manual.isPending}>
            {manual.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
