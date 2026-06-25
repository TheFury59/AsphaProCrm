import { Download, FileText, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDocuments, type DocumentItem } from "@/hooks/use-sub-resources";

const DOC_TYPE_LABELS: Record<string, string> = {
  contract: "Contrat",
  invoice: "Facture",
  insurance: "Assurance",
  product_sheet: "Fiche produit",
  protocol: "Protocole",
  other: "Autre",
};

const EXPIRY_SOON_DAYS = 30;

type ExpiryStatus = "none" | "ok" | "soon" | "expired";

function expiryStatus(expiry: string | null): ExpiryStatus {
  if (!expiry) return "none";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(expiry + "T00:00:00");
  if (Number.isNaN(date.getTime())) return "none";
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return "expired";
  if (diffDays <= EXPIRY_SOON_DAYS) return "soon";
  return "ok";
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR");
}

/**
 * Section « Mes documents » de l'extranet (client ET intervenant).
 *
 * Consomme l'endpoint `/documents` existant. ⚠️ La visibilité est filtrée
 * CÔTÉ BACKEND (DocumentController : audience attendue + is_client_visible) —
 * ce composant n'applique AUCUN filtre de sécurité, il se contente d'afficher
 * la liste que l'API renvoie. Ne jamais déplacer le filtre ici (IDOR).
 *
 * - extranet client      : ownerType="client",   ownerId = id du client.
 * - extranet intervenant : ownerType="employee", ownerId = id de l'employee.
 */
export function ExtranetDocumentsSection({
  ownerType,
  ownerId,
}: {
  ownerType: "client" | "employee";
  ownerId: number | undefined;
}) {
  const { data: docs = [], isLoading } = useDocuments(ownerType, ownerId ?? 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" /> Mes documents ({docs.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun document partagé avec vous.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {docs.map((d: DocumentItem) => {
              const status = expiryStatus(d.expiry_date);
              return (
                <li key={d.id} className="flex items-center justify-between border rounded p-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{d.label}</div>
                      <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <Badge variant="outline" className="text-xs">
                          {DOC_TYPE_LABELS[d.document_type] ?? d.document_type}
                        </Badge>
                        {d.size_kb ? <span>{d.size_kb} ko</span> : null}
                        {status !== "none" && (
                          <span
                            className={
                              status === "expired"
                                ? "inline-flex items-center gap-1 text-destructive font-medium"
                                : status === "soon"
                                  ? "inline-flex items-center gap-1 text-amber-600 font-medium"
                                  : "inline-flex items-center gap-1 text-muted-foreground"
                            }
                          >
                            {(status === "expired" || status === "soon") && (
                              <AlertTriangle className="h-3 w-3" />
                            )}
                            {status === "expired" ? "Expiré le " : "Valide jusqu'au "}
                            {formatDate(d.expiry_date!)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <a href={d.download_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    <Button size="sm" variant="ghost"><Download className="h-3.5 w-3.5" /></Button>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
