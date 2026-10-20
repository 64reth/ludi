const positions = [
  [1, 1],
  [3, 1],
  [1, 2],
  [2, 2],
  [3, 2],
  [1, 3],
  [3, 3],
];
const faces: Record<number, number[]> = {
  1: [3],
  2: [0, 6],
  3: [0, 3, 6],
  4: [0, 1, 5, 6],
  5: [0, 1, 3, 5, 6],
  6: [0, 1, 2, 4, 5, 6],
};
export function Dice({
  muted,
  onMute,
  values,
  remaining,
  onRoll,
  disabled,
  rolling = false,
  label = "Roll dice",
}: {
  muted: boolean;
  onMute: () => void;
  values: [number, number] | null;
  remaining: number[];
  onRoll: () => void;
  disabled: boolean;
  rolling?: boolean;
  label?: string;
}) {
  return (
    <section className="dice-section">
      <div className="panel-heading">
        <span className="eyebrow">DICE</span>
        <button
          className="text-button"
          aria-label={muted ? "Unmute game sound" : "Mute game sound"}
          onClick={onMute}
        >
          {muted ? "Sound off" : "Sound on"}
        </button>
      </div>
      <div
        className={`dice-tray ${rolling ? "rolling" : ""}`}
        aria-label={
          values
            ? `Dice result: ${values[0]} and ${values[1]}`
            : "Dice not yet rolled"
        }
      >
        {(values ?? [1, 1]).map((v, i) => (
          <div
            key={i}
            className={`die ${values && !remaining.includes(i) ? "spent" : ""}`}
            aria-label={
              values
                ? `Die ${i + 1}: ${v}${remaining.includes(i) ? " available" : " used"}`
                : `Die ${i + 1}: not rolled`
            }
          >
            {positions.map(([x, y], p) => (
              <i
                key={p}
                style={{
                  gridColumn: x,
                  gridRow: y,
                  visibility:
                    values && faces[v].includes(p) ? "visible" : "hidden",
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <button
        className="primary full"
        aria-label="Roll dice"
        disabled={disabled || rolling}
        onClick={onRoll}
      >
        {rolling ? "Rolling…" : label}
        <span aria-hidden="true">↗</span>
      </button>
    </section>
  );
}
