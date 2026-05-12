import { useState } from "react";
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
import { apiErrorMessage } from "@/lib/api";

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

  const create = () => {
    const payload: any = {};
    if (addressId) payload.address_id = +addressId;
    generate.mutate(payload, {
      onSuccess: (qr) => {
        toast.success(`QR généré : ${qr.code}`);
        setOpenCreate(false);
        setAddressId("");
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
                Lie le QR à une adresse client (optionnel). Le QR sert au badgeage in/out sur place.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-2">
              <Label>Address ID (optionnel)</Label>
              <Input
                type="number"
                value={addressId}
                onChange={(e) => setAddressId(e.target.value)}
                placeholder="—"
              />
            </div>
            <DialogFooter>
              <Button onClick={create} disabled={generate.isPending}>
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
                <TableHead>Généré le</TableHead>
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
                    {format(new Date(q.generated_at), "dd/MM/yy HH:mm", { locale: fr })}
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
                <TableHead>Action</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Intervention</TableHead>
                <TableHead>Manuel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs">{format(new Date(l.scanned_at), "dd/MM HH:mm:ss", { locale: fr })}</TableCell>
                  <TableCell>
                    <Badge variant={l.action === "in" ? "default" : "outline"}>
                      {l.action === "in" ? "Entrée" : "Sortie"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{l.source}</TableCell>
                  <TableCell className="text-xs">{l.intervention_id ?? "—"}</TableCell>
                  <TableCell>
                    {l.is_manual && <Badge variant="secondary" className="text-xs">Manuel</Badge>}
                  </TableCell>
                </TableRow>
              ))}
              {data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
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

function ManualEntryTab() {
  const [form, setForm] = useState({
    intervention_id: "",
    action: "in" as "in" | "out",
    scanned_at: new Date().toISOString().slice(0, 16),
    reason: "",
  });
  const manual = useManualEntry();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    manual.mutate(
      {
        intervention_id: +form.intervention_id,
        action: form.action,
        scanned_at: form.scanned_at + ":00",
        reason: form.reason,
      },
      {
        onSuccess: () => {
          toast.success("Saisie manuelle enregistrée");
          setForm({ ...form, intervention_id: "", reason: "" });
        },
        onError: (e) => toast.error(apiErrorMessage(e)),
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
        <form onSubmit={submit} className="grid gap-3 max-w-md">
          <div className="grid gap-1">
            <Label>Intervention ID *</Label>
            <Input
              type="number"
              required
              value={form.intervention_id}
              onChange={(e) => setForm({ ...form, intervention_id: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label>Action</Label>
              <select
                className="rounded-md border bg-background px-3 py-2 text-sm"
                value={form.action}
                onChange={(e) => setForm({ ...form, action: e.target.value as "in" | "out" })}
              >
                <option value="in">Entrée</option>
                <option value="out">Sortie</option>
              </select>
            </div>
            <div className="grid gap-1">
              <Label>Date/heure</Label>
              <Input
                type="datetime-local"
                required
                value={form.scanned_at}
                onChange={(e) => setForm({ ...form, scanned_at: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-1">
            <Label>Motif *</Label>
            <Input
              required
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Ex : oubli de badge, problème réseau…"
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
