import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function HomePage() {
  const ping = useQuery({
    queryKey: ["ping"],
    queryFn: async () => (await api.get("/ping")).data as { status: string; time: string },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">Aspha CRM</h1>
      <p className="text-muted-foreground">
        Squelette opérationnel. Backend Laravel + Frontend React. Plus qu'à construire.
      </p>
      <div className="rounded-md border p-4 text-sm">
        <strong>Backend reachability :</strong>{" "}
        {ping.isLoading && "ping…"}
        {ping.isError && <span className="text-destructive">KO ({String(ping.error)})</span>}
        {ping.data && <span className="text-green-600">OK — {ping.data.time}</span>}
      </div>
    </div>
  );
}
