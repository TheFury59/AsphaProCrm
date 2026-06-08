import { useMemo, useState } from "react";
import { Plus, QrCode, RefreshCw, ScanLine, Search } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useCheckinLogs,
  useManualEntry,
} from "@/hooks/use-operations";
import { useEmployees } from "@/hooks/use-employees";
import { api, apiErrorMessage } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { QrCodesPanel } from "@/components/telegestion/QrCodesPanel";

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
          <QrCodesPanel />
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

// =========================================================================
// LOGS TAB
// =========================================================================

function LogsTab() {
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const { data: employees } = useEmployees({ per_page: 200 });

  // 2026-06-08 — paramètres serveur (cf. backend updated).
  const params: Record<string, any> = { per_page: 100 };
  if (employeeFilter !== "all") params.employee_id = Number(employeeFilter);
  if (eventTypeFilter !== "all") params.event_type = eventTypeFilter;
  if (from) params.from = from;
  if (to) params.to = to;

  const { data, isLoading } = useCheckinLogs(params);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ScanLine className="h-4 w-4" />
          Journal des badgeages
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Filtres */}
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
          <div className="grid gap-1">
            <Label className="text-xs">Intervenant</Label>
            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {employees?.data?.map((emp: any) => (
                  <SelectItem key={emp.id} value={String(emp.id)}>
                    {emp.full_name ?? emp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1">
            <Label className="text-xs">Événement</Label>
            <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="arrival">Arrivée</SelectItem>
                <SelectItem value="departure">Départ</SelectItem>
                <SelectItem value="unrecognized">Inconnu</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1">
            <Label className="text-xs">Du</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <div className="grid gap-1">
            <Label className="text-xs">Au</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </div>

        {/* Tableau */}
        <div className="rounded-md border">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : !data || data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ScanLine className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Aucun badgeage enregistré.</p>
              <p className="text-xs">
                Les pointages apparaissent ici dès qu'un intervenant scanne un QR ou
                qu'un admin saisit un pointage.
              </p>
            </div>
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
                {data.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs">
                      {l.called_at
                        ? format(new Date(l.called_at), "dd/MM/yy HH:mm:ss", { locale: fr })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {l.event_type === "arrival" && <Badge variant="default">Arrivée</Badge>}
                      {l.event_type === "departure" && <Badge variant="outline">Départ</Badge>}
                      {l.event_type === "unrecognized" && (
                        <Badge variant="destructive">Inconnu</Badge>
                      )}
                    </TableCell>
                    <TableCell>
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
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// =========================================================================
// MANUAL ENTRY TAB
// =========================================================================

/**
 * Fetch léger des interventions récentes pour le picker de saisie manuelle.
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

  const DEFAULT_COMMENT = "Saisie manuelle — oubli de badgeage";

  const [employeeSearch, setEmployeeSearch] = useState("");
  const [form, setForm] = useState({
    employee_id: "",
    intervention_id: "",
    checkin_time: nowDatetimeLocal(),
    checkout_time: "",
    comment: DEFAULT_COMMENT,
  });
  const manual = useManualEntry();

  // Quand on choisit une intervention, on pré-affecte l'intervenant.
  const handleInterventionChange = (val: string) => {
    const iv = interventions?.find((i) => String(i.id) === val);
    setForm((f) => ({
      ...f,
      intervention_id: val,
      employee_id: iv?.employee?.id ? String(iv.employee.id) : f.employee_id,
    }));
  };

  const employeeOptions = useMemo(() => {
    const all = employees?.data ?? [];
    const q = employeeSearch.trim().toLowerCase();
    if (!q) return all;
    return all.filter((e: any) =>
      (e.full_name ?? e.name ?? "").toLowerCase().includes(q),
    );
  }, [employees, employeeSearch]);

  // Interventions filtrées par intervenant si l'admin a déjà choisi.
  const interventionOptions = useMemo(() => {
    if (!interventions) return [];
    if (!form.employee_id) return interventions;
    return interventions.filter(
      (iv) => iv.employee?.id && String(iv.employee.id) === form.employee_id,
    );
  }, [interventions, form.employee_id]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employee_id) {
      toast.error("Choisis un intervenant.");
      return;
    }
    if (!form.checkin_time && !form.checkout_time) {
      toast.error("Renseigne au moins une date (arrivée ou départ).");
      return;
    }

    try {
      manual.mutate(
        {
          employee_id: +form.employee_id,
          intervention_id: form.intervention_id ? +form.intervention_id : null,
          checkin_time: form.checkin_time ? form.checkin_time + ":00" : null,
          checkout_time: form.checkout_time ? form.checkout_time + ":00" : null,
          comment: form.comment || undefined,
        },
        {
          onSuccess: () => {
            toast.success("Saisie manuelle enregistrée.");
            setForm({
              employee_id: "",
              intervention_id: "",
              checkin_time: nowDatetimeLocal(),
              checkout_time: "",
              comment: DEFAULT_COMMENT,
            });
          },
          onError: (err) => {
            toast.error(apiErrorMessage(err));
            console.error("[ManualEntryTab] manualEntry failed", err);
          },
        },
      );
    } catch (err) {
      toast.error("Erreur inattendue.");
      console.error("[ManualEntryTab] unexpected", err);
    }
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
        <form onSubmit={submit} className="grid gap-4 max-w-2xl">
          {/* Intervenant */}
          <div className="grid gap-1.5">
            <Label>Intervenant *</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                placeholder="Rechercher un intervenant…"
                className="pl-7 h-8 text-sm mb-1"
              />
            </div>
            <Select
              value={form.employee_id}
              onValueChange={(val) => setForm({ ...form, employee_id: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir un intervenant…" />
              </SelectTrigger>
              <SelectContent>
                {employeeOptions.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Aucun intervenant.
                  </div>
                )}
                {employeeOptions.map((emp: any) => (
                  <SelectItem key={emp.id} value={String(emp.id)}>
                    {emp.full_name ?? emp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Intervention (optionnel) */}
          <div className="grid gap-1.5">
            <Label>Intervention (optionnel)</Label>
            <Select
              value={form.intervention_id || "none"}
              onValueChange={(v) =>
                handleInterventionChange(v === "none" ? "" : v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Sans intervention rattachée" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Aucune —</SelectItem>
                {interventionOptions.map((iv) => (
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
            <p className="text-xs text-muted-foreground">
              Filtre auto par intervenant choisi. Laisse vide si le pointage ne se
              rattache à aucune intervention planifiée.
            </p>
          </div>

          {/* Heures */}
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label>Arrivée</Label>
              <Input
                type="datetime-local"
                value={form.checkin_time}
                onChange={(e) => setForm({ ...form, checkin_time: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Départ</Label>
              <Input
                type="datetime-local"
                value={form.checkout_time}
                onChange={(e) => setForm({ ...form, checkout_time: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Commentaire</Label>
            <Textarea
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
              placeholder="Ex : oubli de badge, problème réseau…"
              rows={3}
            />
          </div>

          <div>
            <Button type="submit" disabled={manual.isPending}>
              {manual.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * Helper : datetime local au format `YYYY-MM-DDTHH:MM` pour `<input
 * type=datetime-local>`. On évite `toISOString()` qui décale en UTC.
 * (cf. lessons 2026-05-18 — off-by-one day).
 */
function nowDatetimeLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${M}-${dd}T${hh}:${mm}`;
}
