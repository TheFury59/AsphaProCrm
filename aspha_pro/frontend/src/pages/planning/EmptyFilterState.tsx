import { useState } from "react";
import { UserCog, Users, Search, Calendar, ArrowRight, Check, X, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Écran d'accueil du planning quand aucun filtre n'est sélectionné.
 *
 * Règle métier : pas d'affichage "Tous" possible (trop de données). L'admin
 * doit choisir un intervenant, OU un client, OU les deux (intersection).
 *
 * Workflow refondu :
 *  - Sélection EN ATTENTE (pendingEmployeeId / pendingClientId) côté local
 *  - On peut sélectionner intervenant ET client en parallèle
 *  - Bandeau sticky en haut résume la sélection en cours + bouton "Afficher le planning"
 *  - Clic sur "Afficher" → applique au parent (pickEmployee + pickClient)
 *  - Re-clic sur un item déjà sélectionné = désélection
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
  const [pendingEmployeeId, setPendingEmployeeId] = useState<number | null>(null);
  const [pendingClientId, setPendingClientId] = useState<number | null>(null);

  const pendingEmployee = employees.find((e) => e.id === pendingEmployeeId);
  const pendingClient = clients.find((c) => c.id === pendingClientId);

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

  const apply = () => {
    if (pendingEmployeeId) onPickEmployee(pendingEmployeeId);
    if (pendingClientId) onPickClient(pendingClientId);
  };

  const hasPending = pendingEmployeeId !== null || pendingClientId !== null;

  return (
    <div className="rounded-2xl bg-card shadow-soft p-6 lg:p-10">
      <div className="text-center max-w-2xl mx-auto mb-6">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-aspha text-white shadow-brand mb-4">
          <Calendar className="h-7 w-7" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Sélectionnez un planning</h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Chaque intervenant et chaque client a son propre planning. Choisissez{" "}
          <span className="font-medium text-foreground">un intervenant</span>,{" "}
          <span className="font-medium text-foreground">un client</span>, ou{" "}
          <span className="font-medium text-foreground">les deux</span> pour voir l'intersection.
        </p>
      </div>

      {/* Bandeau de sélection en cours + bouton appliquer */}
      {hasPending && (
        <div className="max-w-4xl mx-auto mb-5 rounded-xl border-2 border-primary/30 bg-primary/5 p-3 flex items-center flex-wrap gap-2">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Filtres :</span>
          {pendingEmployee && (
            <Badge variant="secondary" className="gap-1.5 px-2 py-0.5 bg-primary/10 text-primary border-0">
              <UserCog className="h-3 w-3" />
              {pendingEmployee.full_name}
              <button onClick={() => setPendingEmployeeId(null)} className="ml-0.5 hover:bg-primary/20 rounded px-0.5 cursor-pointer">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {pendingClient && (
            <Badge variant="secondary" className="gap-1.5 px-2 py-0.5 bg-sky-500/10 text-sky-700 dark:text-sky-300 border-0">
              <Users className="h-3 w-3" />
              {pendingClient.company?.company_name ?? pendingClient.code}
              <button onClick={() => setPendingClientId(null)} className="ml-0.5 hover:bg-sky-500/20 rounded px-0.5 cursor-pointer">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          <Button
            size="sm"
            onClick={apply}
            className="ml-auto bg-gradient-aspha shadow-brand text-white border-0 hover:opacity-95"
          >
            <Check className="h-3.5 w-3.5 mr-1.5" />
            Afficher le planning
          </Button>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 max-w-4xl mx-auto">
        {/* === Choisir un intervenant === */}
        <div className={`rounded-xl border-2 transition-colors p-5 space-y-3 ${
          pendingEmployeeId ? "border-primary/50 bg-primary/5" : "border-transparent bg-muted/20"
        }`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <UserCog className="h-4 w-4" />
              </div>
              <div>
                <div className="font-semibold text-sm">Par intervenant</div>
                <div className="text-[10px] text-muted-foreground">
                  {pendingEmployeeId ? "Sélectionné" : "Voir tous les RDV d'un salarié"}
                </div>
              </div>
            </div>
            {pendingEmployeeId && (
              <Badge className="bg-primary text-primary-foreground text-[10px] gap-1">
                <Check className="h-2.5 w-2.5" /> Choisi
              </Badge>
            )}
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
              filteredEmployees.map((e) => {
                const isSelected = pendingEmployeeId === e.id;
                return (
                  <button
                    key={e.id}
                    onClick={() => setPendingEmployeeId(isSelected ? null : e.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all text-left cursor-pointer group ${
                      isSelected
                        ? "bg-primary/10 ring-1 ring-primary/40"
                        : "hover:bg-primary/5 hover:ring-1 hover:ring-primary/20"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{e.full_name}</div>
                      {e.current_contract?.position && (
                        <div className="text-[10px] text-muted-foreground truncate">{e.current_contract.position}</div>
                      )}
                    </div>
                    {isSelected ? (
                      <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    ) : (
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
                    )}
                  </button>
                );
              })
            )}
            {employees.length > 8 && filteredEmployees.length === 8 && !empSearch && (
              <p className="text-[10px] text-muted-foreground px-2 py-1 italic">
                + {employees.length - 8} autres — utilisez la recherche
              </p>
            )}
          </div>
        </div>

        {/* === Choisir un client === */}
        <div className={`rounded-xl border-2 transition-colors p-5 space-y-3 ${
          pendingClientId ? "border-sky-500/50 bg-sky-500/5" : "border-transparent bg-muted/20"
        }`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <div className="font-semibold text-sm">Par client</div>
                <div className="text-[10px] text-muted-foreground">
                  {pendingClientId ? "Sélectionné" : "Voir tous les RDV chez un client"}
                </div>
              </div>
            </div>
            {pendingClientId && (
              <Badge className="bg-sky-500 text-white text-[10px] gap-1">
                <Check className="h-2.5 w-2.5" /> Choisi
              </Badge>
            )}
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
              filteredClients.map((c) => {
                const isSelected = pendingClientId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setPendingClientId(isSelected ? null : c.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all text-left cursor-pointer group ${
                      isSelected
                        ? "bg-sky-500/10 ring-1 ring-sky-500/40"
                        : "hover:bg-sky-500/5 hover:ring-1 hover:ring-sky-500/20"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{c.company?.company_name ?? c.display_name ?? c.code}</div>
                      <div className="text-[10px] text-muted-foreground font-mono truncate">{c.code}</div>
                    </div>
                    {isSelected ? (
                      <Check className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                    ) : (
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
                    )}
                  </button>
                );
              })
            )}
            {clients.length > 8 && filteredClients.length === 8 && !clientSearch && (
              <p className="text-[10px] text-muted-foreground px-2 py-1 italic">
                + {clients.length - 8} autres — utilisez la recherche
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 text-center text-xs text-muted-foreground">
        💡 Combinez intervenant + client pour voir uniquement les RDV de cet intervenant chez ce client.
      </div>
    </div>
  );
}
