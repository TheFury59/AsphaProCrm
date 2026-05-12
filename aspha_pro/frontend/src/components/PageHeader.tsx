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
      <div>
        {backTo && (
          <Link to={backTo} className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-2">
            <ChevronLeft className="h-3 w-3 mr-1" /> Retour
          </Link>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
