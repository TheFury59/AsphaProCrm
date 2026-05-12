import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function PlaceholderPage({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">Cette page sera implémentée en {phase}.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Module à venir</CardTitle>
          <CardDescription>Le bootstrap de Phase 0 ne contient pas encore ce module.</CardDescription>
        </CardHeader>
        <CardContent>
          <Badge>{phase}</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
