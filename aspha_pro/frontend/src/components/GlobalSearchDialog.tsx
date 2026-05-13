import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, UserCog, Package, FileText, Receipt, Search,
  Calendar, Map, QrCode, Boxes, MessageSquare, Car, Settings, HelpCircle,
} from "lucide-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { useClients } from "@/hooks/use-clients";
import { useEmployees } from "@/hooks/use-employees";
import { useProducts } from "@/hooks/use-products";
import { useQuotes, useInvoices } from "@/hooks/use-phase3";

/**
 * Palette de recherche globale (style Cmd+K / Linear / Notion).
 *
 *  - Recherche multi-entités en parallèle (clients, intervenants, prestations,
 *    devis, factures) via les hooks list existants.
 *  - 300ms debounce pour éviter le spam des API.
 *  - Pages "raccourcis" accessibles même sans saisie (navigation rapide).
 *  - Clavier : ↑/↓ pour naviguer, Enter pour ouvrir, Esc pour fermer.
 *
 * Ouverture : clic sur la barre topbar OU Cmd/Ctrl+K (hook clavier).
 */
export function GlobalSearchDialog({ open, onOpenChange }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Reset à la fermeture
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const enabled = debouncedQuery.length >= 2;

  // Fetch parallèle — limité à 5 résultats par catégorie
  const { data: clientsData } = useClients(enabled ? { search: debouncedQuery, per_page: 5 } : {});
  const { data: employeesData } = useEmployees(enabled ? { search: debouncedQuery, per_page: 5 } : {});
  const { data: productsData } = useProducts(enabled ? { search: debouncedQuery, per_page: 5 } : {});
  const { data: quotesData } = useQuotes(enabled ? { search: debouncedQuery, per_page: 5 } : {});
  const { data: invoicesData } = useInvoices(enabled ? { search: debouncedQuery, per_page: 5 } : {});

  const clients = enabled ? (clientsData?.data ?? []) : [];
  const employees = enabled ? (employeesData?.data ?? []) : [];
  const products = enabled ? (productsData?.data ?? []) : [];
  const quotes = enabled ? (quotesData?.data ?? []) : [];
  const invoices = enabled ? (invoicesData?.data ?? []) : [];

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  const totalResults = clients.length + employees.length + products.length + quotes.length + invoices.length;

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Recherche globale"
      description="Cherchez clients, intervenants, devis, factures…"
    >
      <CommandInput
        placeholder="Rechercher (clients, intervenants, prestations, devis, factures)…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {!enabled && (
          <>
            <CommandGroup heading="Pages">
              <NavItem icon={Calendar} label="Planning" path="/planning" onSelect={go} />
              <NavItem icon={Users} label="Clients" path="/clients" onSelect={go} />
              <NavItem icon={UserCog} label="Intervenants" path="/intervenants" onSelect={go} />
              <NavItem icon={Package} label="Prestations" path="/prestations" onSelect={go} />
              <NavItem icon={Map} label="Carte" path="/carte" onSelect={go} />
              <NavItem icon={QrCode} label="Télégestion" path="/telegestion" onSelect={go} />
              <NavItem icon={Boxes} label="Stock" path="/stock" onSelect={go} />
              <NavItem icon={MessageSquare} label="Messagerie" path="/messagerie" onSelect={go} />
              <NavItem icon={Car} label="Flotte véhicule" path="/flotte" onSelect={go} />
              <NavItem icon={FileText} label="Devis" path="/devis" onSelect={go} />
              <NavItem icon={Receipt} label="Factures" path="/factures" onSelect={go} />
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Admin">
              <NavItem icon={Settings} label="Paramètres" path="/parametres" onSelect={go} />
              <NavItem icon={HelpCircle} label="Aide & documentation" path="/aide" onSelect={go} />
            </CommandGroup>
            <div className="px-3 py-3 text-[10px] text-muted-foreground border-t mt-1">
              💡 Tapez au moins 2 caractères pour rechercher dans la base.
            </div>
          </>
        )}

        {enabled && totalResults === 0 && (
          <CommandEmpty>
            <div className="py-6 text-center">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Aucun résultat pour « {debouncedQuery} »</p>
              <p className="text-xs text-muted-foreground mt-1">
                Essayez avec d'autres mots-clés (nom, code, SIRET, email…)
              </p>
            </div>
          </CommandEmpty>
        )}

        {clients.length > 0 && (
          <CommandGroup heading={`Clients (${clients.length})`}>
            {clients.map((c: any) => (
              <CommandItem key={`client-${c.id}`} value={`client ${c.code} ${c.company?.company_name ?? ""}`} onSelect={() => go(`/clients/${c.id}`)}>
                <Users className="h-3.5 w-3.5 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{c.company?.company_name ?? c.display_name ?? c.code}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{c.code}</div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {employees.length > 0 && (
          <CommandGroup heading={`Intervenants (${employees.length})`}>
            {employees.map((e: any) => (
              <CommandItem key={`emp-${e.id}`} value={`emp ${e.full_name}`} onSelect={() => go(`/intervenants/${e.id}`)}>
                <UserCog className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{e.full_name}</div>
                  {e.current_contract?.position && (
                    <div className="text-[10px] text-muted-foreground truncate">{e.current_contract.position}</div>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {products.length > 0 && (
          <CommandGroup heading={`Prestations (${products.length})`}>
            {products.map((p: any) => (
              <CommandItem key={`prod-${p.id}`} value={`prod ${p.code} ${p.name}`} onSelect={() => go(`/prestations`)}>
                <Package className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{p.name}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{p.code}</div>
                </div>
                {p.price && <span className="text-[10px] text-muted-foreground">{p.price} €</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {quotes.length > 0 && (
          <CommandGroup heading={`Devis (${quotes.length})`}>
            {quotes.map((q: any) => (
              <CommandItem key={`q-${q.id}`} value={`devis ${q.reference}`} onSelect={() => go("/devis")}>
                <FileText className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-mono truncate">{q.reference ?? `Devis #${q.id}`}</div>
                  <div className="text-[10px] text-muted-foreground">{q.status}</div>
                </div>
                {q.total && <span className="text-[10px] text-muted-foreground">{Number(q.total).toFixed(2)} €</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {invoices.length > 0 && (
          <CommandGroup heading={`Factures (${invoices.length})`}>
            {invoices.map((inv: any) => (
              <CommandItem key={`inv-${inv.id}`} value={`facture ${inv.reference}`} onSelect={() => go("/factures")}>
                <Receipt className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-mono truncate">{inv.reference ?? `INV-${inv.id}`}</div>
                  <div className="text-[10px] text-muted-foreground">{inv.payment_status}</div>
                </div>
                {inv.total && <span className="text-[10px] text-muted-foreground">{Number(inv.total).toFixed(2)} €</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

function NavItem({ icon: Icon, label, path, onSelect }: {
  icon: any; label: string; path: string; onSelect: (p: string) => void;
}) {
  return (
    <CommandItem value={`nav ${label}`} onSelect={() => onSelect(path)}>
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-sm">{label}</span>
      <span className="text-[10px] text-muted-foreground ml-auto font-mono">{path}</span>
    </CommandItem>
  );
}
