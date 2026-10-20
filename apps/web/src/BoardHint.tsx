import type { ReactNode } from "react";
export function BoardHint({
  text,
  onExplain,
  children,
  label,
}: {
  text: string;
  label: string;
  onExplain?: (text: string) => void;
  children: ReactNode;
}) {
  if (!onExplain) return <g>{children}</g>;
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={label}
      style={{ pointerEvents: "all", cursor: "help" }}
      onMouseEnter={() => onExplain?.(text)}
      onFocus={() => onExplain?.(text)}
      onClick={(e) => {
        e.stopPropagation();
        onExplain?.(text);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onExplain?.(text);
        }
      }}
    >
      <title>{text}</title>
      {children}
    </g>
  );
}
