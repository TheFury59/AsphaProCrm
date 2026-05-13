import { ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";

type Props = {
  title: string;
  description?: string;
  backTo?: string;
  actions?: React.ReactNode;
};

export function PageHeader({ title, description, backTo, actions }: Props) {
  return (
    <div className="flex items-start justify-between mb-6 gap-4">
      <div className="min-w-0">
        {backTo && (
          <Link
            to={backTo}
            className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-2 transition-colors group"
          >
            <ChevronLeft className="h-3 w-3 mr-1 group-hover:-translate-x-0.5 transition-transform" /> Retour
          </Link>
        )}
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight leading-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
