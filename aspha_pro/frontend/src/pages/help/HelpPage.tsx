import { useMemo, useState } from "react";
import { Search, HelpCircle, ChevronRight, ChevronDown, BookOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

type HelpArticleSummary = {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  category: string;
  audience: string;
};

type HelpArticleFull = HelpArticleSummary & { body: string; updated_at: string };

// Labels FR pour les catégories en kebab-case envoyées par le backend.
// Toute catégorie absente de cette table est affichée telle quelle.
const CATEGORY_LABELS: Record<string, string> = {
  demarrage: "🚀 Démarrage",
  dashboard: "📊 Tableau de bord",
  clients: "👥 Clients",
  intervenants: "👷 Intervenants",
  missions: "📁 Missions",
  planning: "📅 Planning",
  ventes: "💰 Ventes (devis, factures, règlements)",
  prestations: "🧰 Prestations",
  stock: "📦 Stock",
  tickets: "🎫 Tickets",
  messagerie: "💬 Messagerie",
  documents: "📄 Documents",
  notifications: "🔔 Notifications",
  flotte: "🚗 Flotte",
  telegestion: "🕒 Télégestion",
  carte: "🗺️ Carte",
  parametres: "⚙️ Paramètres",
  "admin-users": "🔐 Utilisateurs admin",
  facturation: "💰 Ventes (devis, factures, règlements)",
  "extranet-intervenant": "🧑‍🔧 Extranet intervenant",
  "extranet-client": "🏢 Extranet client",
  intervenant: "🧑‍🔧 Extranet intervenant",
  client: "🏢 Extranet client",
};

const AUDIENCE_LABELS: Record<string, string> = {
  all: "Tous",
  admin: "Admin",
  intervenant: "Intervenant",
  client: "Client",
  encadrement: "Encadrement",
};

// Ordre d'affichage stable des catégories — les inconnues passent à la fin.
const CATEGORY_ORDER = [
  "demarrage", "dashboard",
  "clients", "intervenants", "missions",
  "planning", "telegestion", "carte",
  "ventes", "facturation",
  "prestations", "stock",
  "tickets", "messagerie", "documents",
  "notifications", "flotte",
  "parametres", "admin-users",
  "extranet-intervenant", "intervenant",
  "extranet-client", "client",
];

/**
 * Page d'aide in-app.
 *
 * Layout 2 colonnes (240px sidebar / contenu) :
 *  - Sidebar : recherche + catégories repliables + liste d'articles
 *  - Contenu : article Markdown rendu avec react-markdown + remark-gfm
 *    (supporte tables, listes de tâches, etc.)
 *
 * Pas de pagination — la liste tient en mémoire (< 200 articles).
 */
export function HelpPage() {
  const [search, setSearch] = useState("");
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());

  const { data: articles = [], isLoading: loadingList } = useQuery({
    queryKey: ["help", "articles", search],
    queryFn: async () => {
      const { data } = await api.get<{ data: HelpArticleSummary[] }>("/help/articles", {
        params: search ? { search } : {},
      });
      return data.data;
    },
  });

  const { data: article, isLoading: loadingArticle } = useQuery({
    queryKey: ["help", "article", activeSlug],
    enabled: !!activeSlug,
    queryFn: async () => (await api.get<{ data: HelpArticleFull }>(`/help/articles/${activeSlug}`)).data.data,
  });

  // Groupage + tri par CATEGORY_ORDER puis par display_order côté serveur (préservé).
  const byCategory = useMemo(() => {
    const groups = articles.reduce<Record<string, HelpArticleSummary[]>>((acc, a) => {
      (acc[a.category] ??= []).push(a);
      return acc;
    }, {});
    const ordered: Array<[string, HelpArticleSummary[]]> = [];
    for (const cat of CATEGORY_ORDER) {
      if (groups[cat]) {
        ordered.push([cat, groups[cat]]);
        delete groups[cat];
      }
    }
    // Catégories non listées dans CATEGORY_ORDER : à la fin, ordre alpha.
    for (const cat of Object.keys(groups).sort()) {
      ordered.push([cat, groups[cat]]);
    }
    return ordered;
  }, [articles]);

  const toggleCat = (cat: string) => {
    setCollapsedCats((s) => {
      const next = new Set(s);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const totalCount = articles.length;

  return (
    <div>
      <PageHeader
        title="Aide & Documentation"
        description="Tous les guides d'utilisation de l'ERP Aspha. Cherche par mot-clé ou parcours par catégorie."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 h-[80vh] min-h-0">
        {/* Sidebar — pareil que le contenu : `min-h-0` sur Card + ScrollArea
            pour que le scroll s'enclenche quand toutes les catégories sont
            dépliées (48 articles ne tiennent pas en hauteur 80vh). */}
        <Card className="overflow-hidden flex flex-col min-h-0">
          <div className="p-3 border-b space-y-2 shrink-0">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher dans l'aide…"
                className="pl-8 h-9 text-sm"
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
              <span>{totalCount} article{totalCount > 1 ? "s" : ""}</span>
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="hover:text-foreground underline underline-offset-2"
                >
                  Effacer
                </button>
              )}
            </div>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-2 space-y-1">
              {loadingList && (
                <>
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-3/4" />
                </>
              )}
              {!loadingList && byCategory.length === 0 && (
                <p className="text-xs text-muted-foreground p-2 text-center">
                  Aucun article ne correspond à ta recherche.
                </p>
              )}
              {byCategory.map(([cat, list]) => {
                const isCollapsed = collapsedCats.has(cat);
                const label = CATEGORY_LABELS[cat] ?? cat;
                return (
                  <div key={cat}>
                    <button
                      type="button"
                      onClick={() => toggleCat(cat)}
                      className="w-full flex items-center gap-1 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                      <span className="flex-1 text-left">{label}</span>
                      <span className="text-muted-foreground/60 normal-case text-[10px] font-normal">
                        ({list.length})
                      </span>
                    </button>
                    {!isCollapsed && (
                      <ul className="space-y-0.5 ml-1 mb-1">
                        {list.map((a) => (
                          <li key={a.slug}>
                            <button
                              type="button"
                              onClick={() => setActiveSlug(a.slug)}
                              className={
                                "w-full text-left px-2.5 py-1.5 rounded text-[13px] transition-colors leading-tight " +
                                (activeSlug === a.slug
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "hover:bg-accent")
                              }
                            >
                              {a.title}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </Card>

        {/* Contenu — `flex flex-col` + `flex-1 min-h-0` sur le ScrollArea pour
            qu'il prenne effectivement la hauteur du grid row (sinon h-full
            résout à `auto` et le contenu déborde sans scrollbar). */}
        <Card className="overflow-hidden flex flex-col min-h-0">
          <ScrollArea className="flex-1 min-h-0">
            <CardContent className="p-8">
              {loadingArticle && activeSlug && (
                <div className="space-y-3">
                  <Skeleton className="h-8 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              )}
              {!loadingArticle && article && (
                <article className="prose prose-sm max-w-3xl dark:prose-invert
                  prose-headings:scroll-mt-4
                  prose-h1:text-2xl prose-h1:font-bold prose-h1:mb-2
                  prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-h2:border-b prose-h2:pb-1
                  prose-h3:text-base prose-h3:mt-5 prose-h3:mb-2
                  prose-p:leading-relaxed
                  prose-table:text-sm prose-th:bg-muted/50 prose-th:px-3 prose-th:py-2
                  prose-td:px-3 prose-td:py-2 prose-td:border-t
                  prose-blockquote:border-l-primary prose-blockquote:bg-primary/5
                  prose-blockquote:py-1 prose-blockquote:px-3 prose-blockquote:not-italic
                  prose-code:bg-muted prose-code:rounded prose-code:px-1 prose-code:py-0.5
                  prose-code:text-[0.85em] prose-code:before:content-none prose-code:after:content-none
                  prose-a:text-primary">
                  <div className="not-prose flex items-center gap-2 mb-4 flex-wrap">
                    <Badge variant="outline" className="font-normal">
                      {CATEGORY_LABELS[article.category] ?? article.category}
                    </Badge>
                    {article.audience !== "all" && (
                      <Badge variant="secondary" className="font-normal">
                        {AUDIENCE_LABELS[article.audience] ?? article.audience}
                      </Badge>
                    )}
                    {article.summary && (
                      <span className="text-xs text-muted-foreground italic">
                        {article.summary}
                      </span>
                    )}
                  </div>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{article.body}</ReactMarkdown>
                </article>
              )}
              {!activeSlug && !loadingArticle && (
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-24">
                  <BookOpen className="h-14 w-14 mb-4 opacity-40" />
                  <p className="text-base font-medium">Bienvenue dans l'aide Aspha Pro</p>
                  <p className="text-sm mt-2 max-w-md">
                    Sélectionne un article dans la sidebar ou utilise la recherche pour
                    trouver une réponse à ta question.
                  </p>
                  <div className="mt-6 flex items-center gap-1.5 text-xs text-muted-foreground/70">
                    <HelpCircle className="h-3.5 w-3.5" />
                    Articles classés par catégorie (clique sur le titre d'une catégorie pour la replier)
                  </div>
                </div>
              )}
            </CardContent>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}
