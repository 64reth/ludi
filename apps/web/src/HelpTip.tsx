import { Icon, CircleHelp } from "./icons";
import { useId, type ReactNode } from "react";
export function HelpTip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <details className="help-tip">
      <summary aria-label={`Explain ${label}`} aria-describedby={id}>
        <Icon icon={CircleHelp} />
      </summary>
      <span role="tooltip" id={id}>
        {children}
      </span>
    </details>
  );
}
