import { useState } from "react";
import { Search } from "lucide-react";
import { useProducts } from "@/hooks/use-products";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const typeLabels: Record<string, string> = {
  hourly: "Horaire",
  forfait: "Forfait",
  frais: "Frais",
  remise: "Remise",
  carte: "Carte",
  exceptional: "Exceptionnel",
};

export function ProductsListPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useProducts({ per_page: 100, search });

  return (
    <div>
      <PageHeader
        title="Catalogue prestations"
        description="Produits & services proposés par Aspha — utilisés dans les devis et plannings."
      />

      <div className="mb-4 relative max-w-sm">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom, code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : data?.data.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">Aucune prestation dans le catalogue.</p>
            <p className="text-xs text-muted-foreground mt-1">La cliente fournira la liste des prestations standard.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data?.data.map((p) => (
            <Card key={p.id} className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">{p.name}</CardTitle>
                  <Badge variant={p.status === "active" ? "default" : "secondary"} className="text-xs shrink-0">
                    {p.status}
                  </Badge>
                </div>
                <CardDescription className="text-xs font-mono">{p.code}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl font-semibold">{p.price.toFixed(2)} €</span>
                  <Badge variant="outline" className="text-xs">{typeLabels[p.type] ?? p.type}</Badge>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {p.category && <div>Catégorie : <span className="text-foreground">{p.category.label}</span></div>}
                  {p.default_duration_minutes && <div>Durée standard : <span className="text-foreground">{p.default_duration_minutes} min</span></div>}
                  {p.vat_rate && <div>TVA : <span className="text-foreground">{p.vat_rate.rate}%</span></div>}
                  {p.has_degressive_pricing && <Badge variant="secondary" className="text-xs mt-1">Tarif dégressif</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
