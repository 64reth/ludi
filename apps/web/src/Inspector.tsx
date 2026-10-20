import { useState } from "react";
import { serialize, type Rules } from "../../../packages/rules/index";
export default function Inspector({
  rules,
  inspection,
  stack,
  onStack,
  onReset,
  onClose,
}: {
  rules: Rules;
  inspection: string;
  stack: boolean;
  onStack: () => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [notice, setNotice] = useState("");
  return (
    <aside className="inspector">
      <div className="button-row">
        <h2>Development inspector</h2>
        <button onClick={onClose}>Close</button>
      </div>
      <p>
        {inspection ||
          "Select a cell to inspect its stable ID and coordinates."}
      </p>
      <button aria-pressed={stack} onClick={onStack}>
        Stack counters
      </button>
      <button onClick={onReset}>Reset board</button>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(serialize(rules));
            setNotice("Copied");
          } catch {
            setNotice("Copy from the JSON below.");
          }
        }}
      >
        Copy JSON
      </button>
      <button
        onClick={() => {
          const u = URL.createObjectURL(
            new Blob([serialize(rules)], { type: "application/json" }),
          );
          const a = document.createElement("a");
          a.href = u;
          a.download = "ludi-rules-v1.json";
          a.click();
          URL.revokeObjectURL(u);
        }}
      >
        Download JSON
      </button>
      <p role="status">{notice}</p>
      <pre>{serialize(rules)}</pre>
      <p>
        Research: docs/board-references.md · docs/rules.md. Geometry remains
        provisional.
      </p>
    </aside>
  );
}
