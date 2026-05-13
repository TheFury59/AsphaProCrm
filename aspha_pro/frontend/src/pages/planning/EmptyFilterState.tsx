import { useState } from "react";
import { UserCog, Users, Search, Calendar, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * Écran d'accueil du planning quand aucun filtre n'est sélectionné.
 *
 * Règle métier (cf. user) :
 *   Le planning ne peut PAS afficher tous les RDV d'un coup (trop de données).
 *   L'admin doit OBLIGATOIREMENT choisir un intervenant OU un client (ou les
 *   deux pour voir l'intersection : tous les RDV de X chez Y).
 *
 * Le composant propose les 2 entrées principales avec recherche autocomplete
 * pour aller vite quand il y a 50+ intervenants ou 200+ clients.
 */
export function EmptyFilterState({
  employees, clients, onPickEmployee, onPickClient,
}: {
  employees: any[];
  clients: any[];
  onPickEmployee: (id: number) => void;
  onPickClient: (id: number) => void;
}) {
  const [empSearch, setEmpSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");

  const filteredEmployees = employees
    .filter((e) => !empSearch || e.full_name?.toLowerCase().includes(empSearch.toLowerCase()))
    .slice(0, 8);
  const filteredClients = clients
    .filter((c) =>
      !clientSearch ||
      c.company?.company_name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.code?.toLowerCase().includes(clientSearch.toLowerCase())
    )
    .slice(0, 8);

  return (
    <div className="rounded-2xl bg-card shadow-soft p-6 lg:p-10">
      <div className="text-center max-w-2xl mx-auto mb-8">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-aspha text-white shadow-brand mb-4">
          <Calendar className="h-7 w-7" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Sélectionnez un planning</h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Chaque intervenant et chaque client a son propre planning. Choisissez un{" "}
          <span className="font-medium text-foreground">intervenant</span> ou un{" "}
          <span className="font-medium text-foreground">client</span> ci-dessous pour afficher ses interventions.
          Vous pouvez aussi combiner les deux pour voir tous les RDV d'un intervenant chez un client précis.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 max-w-4xl mx-auto">
        {/* === Choisir un intervenant === */}
        <div className="rounded-xl border bg-muted/20 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <UserCog className="h-4 w-4" />
            </div>
            <div>
              <div className="font-semibold text-sm">Par intervenant</div>
              <div className="text-[10px] text-muted-foreground">Voir tous les RDV d'un salarié</div>
            </div>
          </div>

          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={`Rechercher (${employees.length} intervenants)…`}
              value={empSearch}
              onChange={(e) => setEmpSearch(e.target.value)}
              className="pl-8 h-9 bg-card"
            />
          </div>

          <div className="space-y-1 max-h-[260px] overflow-y-auto">
            {filteredEmployees.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-1">Aucun intervenant.</p>
            ) : (
              filteredEmployees.map((e) => (
                <button
                  key={e.id}
                  onClick={() => onPickEmployee(e.id)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-primary/5 hover:ring-1 hover:ring-primary/20 transition-all text-left cursor-pointer group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{e.full_name}</div>
                    {e.current_contract?.position && (
                      <div className="text-[10px] text-muted-foreground truncate">{e.current_contract.position}</div>
                    )}
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              ))
            )}
            {employees.length > 8 && filteredEmployees.length === 8 && !empSearch && (
              <p className="text-[10px] text-muted-foreground px-2 py-1 italic">
                + {employees.length - 8} autres — utilisez la recherche
              </p>
            )}
          </div>
        </div>

        {/* === Choisir un client === */}
        <div className="rounded-xl border bg-muted/20 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <div className="font-semibold text-sm">Par client</div>
              <div className="text-[10px] text-muted-foreground">Voir tous les RDV chez un client</div>
            </div>
          </div>

          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={`Rechercher (${clients.length} clients)…`}
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className="pl-8 h-9 bg-card"
            />
          </div>

          <div className="space-y-1 max-h-[260px] overflow-y-auto">
            {filteredClients.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-1">Aucun client.</p>
            ) : (
              filteredClients.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onPickClient(c.id)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-sky-500/5 hover:ring-1 hover:ring-sky-500/20 transition-all text-left cursor-pointer group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{c.company?.company_name ?? c.display_name ?? c.code}</div>
                    <div className="text-[10px] text-muted-foreground font-mono truncate">{c.code}</div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              ))
            )}
            {clients.length > 8 && filteredClients.length === 8 && !clientSearch && (
              <p className="text-[10px] text-muted-foreground px-2 py-1 italic">
                + {clients.length - 8} autres — utilisez la recherche
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 text-center text-xs text-muted-foreground">
        Astuce : vous pouvez combiner intervenant + client pour voir uniquement les RDV de cet intervenant chez ce client.
      </div>
    </div>
  );
}
