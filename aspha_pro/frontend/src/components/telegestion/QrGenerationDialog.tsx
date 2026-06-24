import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Download, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { useClients } from "@/hooks/use-clients";
import { useClientAddresses } from "@/hooks/use-sub-resources";
import { useGenerateQrCode } from "@/hooks/use-operations";
import { apiErrorMessage } from "@/lib/api";
import { printQrCodesToPdf } from "@/lib/qr-print-pdf";

type QrGenerationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Si fourni, l'étape 1 (sélecteur client) est masquée et bloquée sur ce client.
   * Utilisé depuis la fiche client.
   */
  lockedClientId?: number | null;
};

/**
 * Dialogue de génération d'un QR code de télégestion.
 *
 * Flow :
 *  1. Sélection client (cmdk avec recherche serveur via `useClients`)
 *     → caché si `lockedClientId` est fourni.
 *  2. Sélection adresse du client (via `useClientAddresses`).
 *  3. Expiration optionnelle (`datetime-local`).
 *
 * Validation au clic (jamais de submit `disabled` métier), toasts sur erreur.
 */
export function QrGenerationDialog({
  open,
  onOpenChange,
  lockedClientId = null,
}: QrGenerationDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(lockedClientId);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [expiresAt, setExpiresAt] = useState("");
  // QR généré (affichage post-succès + bouton PDF). Reset à la réouverture.
  const [generatedQr, setGeneratedQr] = useState<{ code: string; clientName: string; addressLabel: string } | null>(null);
  const [copies, setCopies] = useState(35);
  const [printing, setPrinting] = useState(false);

  // Recherche serveur : la liste est paginée et filtrée par `filter[search]`.
  const { data: clientsPage, isLoading: clientsLoading } = useClients({
    per_page: 50,
    search: search || undefined,
  });
  const clients = clientsPage?.data ?? [];

  const { data: addresses, isLoading: addressesLoading } = useClientAddresses(
    selectedClientId ?? 0,
  );

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );

  // Reset à l'ouverture/fermeture pour ne pas garder un état parasite.
  useEffect(() => {
    if (open) {
      setSelectedClientId(lockedClientId);
      setSelectedAddressId(null);
      setExpiresAt("");
      setSearch("");
      setGeneratedQr(null);
      setCopies(35);
    }
  }, [open, lockedClientId]);

  // Quand on change de client, on reset l'adresse choisie.
  useEffect(() => {
    setSelectedAddressId(null);
  }, [selectedClientId]);

  const generate = useGenerateQrCode();

  const selectedAddress = useMemo(
    () => addresses?.find((a) => a.id === selectedAddressId) ?? null,
    [addresses, selectedAddressId],
  );

  const submit = () => {
    if (!selectedClientId) {
      toast.error("Choisis un client.");
      return;
    }
    if (!selectedAddressId) {
      toast.error("Choisis une adresse.");
      return;
    }
    const payload: { address_id: number; expires_at?: string | null } = {
      address_id: selectedAddressId,
    };
    if (expiresAt) payload.expires_at = expiresAt + ":00";

    try {
      generate.mutate(payload, {
        onSuccess: (qr) => {
          toast.success(`QR généré : ${qr.code}`);
          // Au lieu de fermer, on passe en mode "post-succès" pour proposer
          // le téléchargement PDF directement depuis le dialog.
          const clientName =
            selectedClient?.company?.company_name ?? selectedClient?.display_name ?? "Client";
          const addressLabel = selectedAddress
            ? [selectedAddress.address, selectedAddress.postal_code, selectedAddress.city]
                .filter(Boolean)
                .join(" · ")
            : "";
          setGeneratedQr({ code: qr.code, clientName, addressLabel });
        },
        onError: (err) => {
          toast.error(apiErrorMessage(err));
          console.error("[QrGenerationDialog] generate failed", err);
        },
      });
    } catch (err) {
      toast.error("Erreur inattendue lors de la génération du QR.");
      console.error("[QrGenerationDialog] unexpected error", err);
    }
  };

  const handleDownloadPdf = async () => {
    if (!generatedQr) return;
    setPrinting(true);
    try {
      await printQrCodesToPdf({
        qrCode: generatedQr.code,
        clientName: generatedQr.clientName,
        addressLabel: generatedQr.addressLabel || undefined,
        copies,
      });
      toast.success(`PDF téléchargé (${copies} copies)`);
    } catch (err) {
      console.error("[QrGenerationDialog] PDF print failed", err);
      toast.error("Génération PDF impossible. Réessaie.");
    } finally {
      setPrinting(false);
    }
  };

  // Si un QR a été généré, on bascule l'affichage en mode "succès + PDF".
  // L'utilisateur peut télécharger la planche, ajuster le nombre de copies,
  // puis fermer ou générer un autre QR.
  if (generatedQr) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              QR code généré
            </DialogTitle>
            <DialogDescription>
              Télécharge la planche A4 pour imprimer et coller les vignettes sur site.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-3">
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <div className="font-medium">{generatedQr.clientName}</div>
              {generatedQr.addressLabel && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {generatedQr.addressLabel}
                </div>
              )}
              <div className="text-xs font-mono mt-1.5 break-all">
                Code : <span className="text-foreground">{generatedQr.code}</span>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="copies">Copies par page A4</Label>
              <Input
                id="copies"
                type="number"
                min={1}
                max={70}
                value={copies}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n >= 1 && n <= 70) setCopies(n);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Défaut 35 (grille 5×7). Chaque vignette = nom client en haut, QR au
                milieu, code de secours en bas.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                // Reset pour permettre de générer un autre QR sans fermer.
                setGeneratedQr(null);
                setSelectedAddressId(null);
                if (!lockedClientId) setSelectedClientId(null);
              }}
            >
              Générer un autre
            </Button>
            <Button type="button" onClick={handleDownloadPdf} disabled={printing}>
              {printing ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Génération…
                </>
              ) : (
                <>
                  <Download className="mr-2 h-3.5 w-3.5" />
                  Télécharger PDF
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Générer un QR code</DialogTitle>
          <DialogDescription>
            Lie le QR à une adresse d'intervention. L'intervenant pourra ensuite
            badger arrivée/départ sur place.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Étape 1 — Sélecteur client (masqué si lockedClientId) */}
          {!lockedClientId && (
            <div className="grid gap-1.5">
              <Label>1. Client *</Label>
              {selectedClient ? (
                <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {selectedClient.company?.company_name ?? selectedClient.display_name}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {selectedClient.code}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedClientId(null);
                      setSearch("");
                    }}
                  >
                    Changer
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Chercher par nom ou code…"
                      value={search}
                      onValueChange={setSearch}
                    />
                    <CommandList className="max-h-56">
                      {clientsLoading && (
                        <div className="p-2 space-y-1.5">
                          {[...Array(3)].map((_, i) => (
                            <Skeleton key={i} className="h-7" />
                          ))}
                        </div>
                      )}
                      {!clientsLoading && clients.length === 0 && (
                        <CommandEmpty>Aucun client trouvé.</CommandEmpty>
                      )}
                      {clients.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={String(c.id)}
                          onSelect={() => {
                            setSelectedClientId(c.id);
                          }}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {c.company?.company_name ?? c.display_name}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {c.code}
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                </div>
              )}
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Search className="h-3 w-3" />
                Recherche full-text sur le nom de la société et le code client.
              </p>
            </div>
          )}

          {/* Étape 2 — Adresse */}
          {selectedClientId && (
            <div className="grid gap-1.5">
              <Label>{lockedClientId ? "1. Adresse *" : "2. Adresse *"}</Label>
              {addressesLoading ? (
                <Skeleton className="h-10" />
              ) : !addresses || addresses.length === 0 ? (
                <div className="rounded-md border bg-muted/40 px-3 py-3 text-sm">
                  <p className="text-muted-foreground">
                    Aucune adresse pour ce client.
                  </p>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="px-0 h-auto"
                    onClick={() => {
                      onOpenChange(false);
                      // Navigation simple — la page fiche client gère ses tabs.
                      window.location.href = `/clients/${selectedClientId}#addresses`;
                    }}
                  >
                    Ajouter une adresse →
                  </Button>
                </div>
              ) : (
                <div className="grid gap-1.5 max-h-56 overflow-y-auto rounded-md border p-1">
                  {addresses.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setSelectedAddressId(a.id)}
                      className={
                        "text-left rounded-sm px-2 py-1.5 text-sm transition-colors " +
                        (selectedAddressId === a.id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted")
                      }
                    >
                      <div className="font-medium">{a.address || "Sans rue"}</div>
                      <div
                        className={
                          "text-xs " +
                          (selectedAddressId === a.id
                            ? "text-primary-foreground/80"
                            : "text-muted-foreground")
                        }
                      >
                        {a.postal_code} {a.city}
                        {a.type ? ` · ${a.type}` : ""}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Étape 3 — Expiration optionnelle */}
          {selectedClientId && (
            <div className="grid gap-1.5">
              <Label>
                {lockedClientId ? "2. Expiration (optionnel)" : "3. Expiration (optionnel)"}
              </Label>
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Si renseigné, le QR sera refusé après cette date (HTTP 410).
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={generate.isPending /* technique uniquement */}
          >
            {generate.isPending ? "Génération…" : (
              <>
                <Plus className="mr-2 h-3.5 w-3.5" />
                Générer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
