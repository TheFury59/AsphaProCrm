import { useState } from "react";
import { Search, HelpCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
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

/**
 * Page d'aide in-app : liste à gauche, contenu Markdown rendu à droite.
 * Recherche full-text full-stack (LIKE sur title/summary/body côté backend).
 */
export function HelpPage() {
  const [search, setSearch] = useState("");
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  const { data: articles = [] } = useQuery({
    queryKey: ["help", "articles", search],
    queryFn: async () => {
      const { data } = await api.get<{ data: HelpArticleSummary[] }>("/help/articles", {
        params: search ? { search } : {},
      });
      return data.data;
    },
  });

  const { data: article } = useQuery({
    queryKey: ["help", "article", activeSlug],
    enabled: !!activeSlug,
    queryFn: async () => (await api.get<{ data: HelpArticleFull }>(`/help/articles/${activeSlug}`)).data.data,
  });

  const byCategory = articles.reduce<Record<string, HelpArticleSummary[]>>((acc, a) => {
    (acc[a.category] ??= []).push(a);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Aide & Documentation"
        description="Guides d'utilisation de l'ERP Aspha. Cherche ou parcours par catégorie."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 h-[75vh]">
        <Card className="overflow-hidden flex flex-col">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher…"
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-3">
              {Object.entries(byCategory).map(([cat, list]) => (
                <div key={cat}>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 py-1">
                    {cat}
                  </div>
                  <ul className="space-y-0.5">
                    {list.map((a) => (
                      <li key={a.slug}>
                        <button
                          onClick={() => setActiveSlug(a.slug)}
                          className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-accent ${activeSlug === a.slug ? "bg-accent font-medium" : ""}`}
                        >
                          {a.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {articles.length === 0 && (
                <p className="text-xs text-muted-foreground p-2">Aucun article.</p>
              )}
            </div>
          </ScrollArea>
        </Card>

        <Card className="overflow-hidden">
          <ScrollArea className="h-full">
            <CardContent className="p-6">
              {article ? (
                <article className="prose prose-sm max-w-none dark:prose-invert">
                  <div className="not-prose flex items-center gap-2 mb-4">
                    <Badge variant="outline">{article.category}</Badge>
                    {article.audience !== "all" && (
                      <Badge variant="secondary">{article.audience}</Badge>
                    )}
                  </div>
                  <ReactMarkdown>{article.body}</ReactMarkdown>
                </article>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-24">
                  <HelpCircle className="h-12 w-12 mb-3 opacity-50" />
                  <p className="text-sm">Sélectionne un article à gauche pour le lire.</p>
                </div>
              )}
            </CardContent>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}
