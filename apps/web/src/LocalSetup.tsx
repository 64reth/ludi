import {
  presetNames,
  validate,
  type Rules,
} from "../../../packages/rules/index";
import { colours } from "../../../packages/shared/index";
import type { Seat } from "../../../packages/game-engine/index";
export function LocalSetup({
  mode,
  rules,
  onRules,
  onStart,
  onChangeRules,
  names,
  setNames,
  assigned,
  assign,
}: {
  mode: "solo" | "local";
  rules: Rules;
  onRules: (r: Rules) => void;
  onStart: (seats: Seat[]) => void;
  onChangeRules: () => void;
  names: string[];
  setNames: (names: string[]) => void;
  assigned: number[];
  assign: (colours: number[]) => void;
}) {
  const errors = validate(rules);
  return (
    <section className="local-setup">
      <div className="screen-title">
        <div>
          <span className="kicker">
            {mode === "solo"
              ? "YOU AGAINST THE TABLE"
              : "ONE DEVICE. EVERYONE PLAYS."}
          </span>
          <h1>
            {mode === "solo"
              ? `Solo ${rules.mode === "war" ? "War" : "Heritage"}`
              : "Local table"}
          </h1>
        </div>
        <span className="pill">No connection needed</span>
      </div>
      <div className="local-setup-body">
        <div className="setup-players">
          <label className="setup-count">
            Players
            <select
              aria-label="Number of players"
              value={rules.players}
              onChange={(e) =>
                onRules({
                  ...rules,
                  players: Number(e.target.value),
                  preset: "custom",
                })
              }
            >
              {[2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n} players
                </option>
              ))}
            </select>
          </label>
          {Array.from({ length: rules.players }, (_, i) => (
            <div className="setup-seat" key={i}>
              <span className={`seat-token ${colours[assigned[i]]}`}>
                {i + 1}
              </span>
              <label>
                <span>Player {i + 1} name</span>
                <input
                  aria-label={`Player ${i + 1} name`}
                  maxLength={30}
                  value={names[i]}
                  onChange={(e) =>
                    setNames(
                      names.map((s, j) => (j === i ? e.target.value : s)),
                    )
                  }
                />
              </label>
              <label>
                <span>Colour</span>
                <select
                  aria-label={`Player ${i + 1} colour`}
                  value={assigned[i]}
                  onChange={(e) => {
                    const next = Number(e.target.value),
                      old = assigned[i],
                      other = assigned.indexOf(next);
                    assign(
                      assigned.map((c, j) =>
                        j === i ? next : j === other ? old : c,
                      ),
                    );
                  }}
                >
                  {colours.map((c, j) => (
                    <option key={c} value={j}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Controller</span>
                <select
                  aria-label={`Player ${i + 1} controller`}
                  disabled={i === 0 || mode === "solo"}
                  value={rules.slots[i]}
                  onChange={(e) => {
                    const slots = [...rules.slots];
                    slots[i] = e.target.value as "human" | "computer";
                    onRules({ ...rules, slots, preset: "custom" });
                  }}
                >
                  <option value="human">Human</option>
                  <option value="computer">Computer</option>
                </select>
              </label>
            </div>
          ))}
        </div>
        <aside className="setup-summary">
          <span className="kicker">HOUSE RULES</span>
          <h2>{presetNames[rules.preset]}</h2>
          <p>
            {rules.sixRequired ? "Six to enter" : "Open entry"} ·{" "}
            {rules.blockSize}-counter blocks
            <br />
            {rules.exactFinish ? "Exact finish" : "Open finish"} ·{" "}
            {rules.timer ? `${rules.timer}s turns` : "No timer"}
          </p>
          <button className="secondary" onClick={onChangeRules}>
            Choose match rules →
          </button>
          {mode === "local" && (
            <p className="subtle">
              Pass the device when the turn changes. Choose Human for every
              seat, or mix in computer players.
            </p>
          )}
          {errors.length > 0 && (
            <div className="validation" role="alert">
              {errors.join(" ")}
            </div>
          )}
          <button
            className="primary"
            disabled={
              errors.length > 0 ||
              names.slice(0, rules.players).some((n) => !n.trim())
            }
            onClick={() =>
              onStart(
                Array.from({ length: rules.players }, (_, i) => ({
                  id: `local-${i}`,
                  name:
                    rules.slots[i] === "computer" &&
                    names[i] === `Player ${i + 1}`
                      ? `Computer ${i + 1}`
                      : names[i].trim(),
                  colour: assigned[i],
                  computer: rules.slots[i] === "computer",
                })),
              )
            }
          >
            Start match <span>→</span>
          </button>
        </aside>
      </div>
    </section>
  );
}
