import { useNavigate } from "react-router-dom";
import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * `TableRow` wrapper qui navigue vers `to` au clic.
 *
 * Garde-fou : si le clic est sur un lien (`<a>`) ou un bouton (`<button>`)
 * à l'intérieur de la ligne, la navigation ne se déclenche pas — l'action
 * locale (badge → fiche client, bouton actions, etc.) prime.
 *
 * Utilisé dans toutes les listes admin pour permettre au user de cliquer
 * n'importe où sur la ligne au lieu de viser un bouton "Ouvrir" précis.
 *
 * Usage :
 *   <ClickableRow to={`/clients/${c.id}`}>
 *     <TableCell>...</TableCell>
 *   </ClickableRow>
 */
type Props = React.ComponentProps<typeof TableRow> & {
  to: string;
  /** Si true (default), ajoute cursor-pointer + hover styling cohérent */
  styleHints?: boolean;
};

export function ClickableRow({
  to,
  className,
  onClick,
  children,
  styleHints = true,
  ...rest
}: Props) {
  const navigate = useNavigate();

  return (
    <TableRow
      {...rest}
      className={cn(
        styleHints && "cursor-pointer hover:bg-muted/40 transition-colors",
        className,
      )}
      onClick={(e) => {
        // Préserve les clics sur liens/boutons internes
        const target = e.target as HTMLElement;
        if (target.closest("a,button,[role='button'],input,select,textarea")) {
          onClick?.(e);
          return;
        }
        onClick?.(e);
        if (!e.defaultPrevented) navigate(to);
      }}
    >
      {children}
    </TableRow>
  );
}
