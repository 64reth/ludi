import { useState } from "react";
import {
  fields,
  preset,
  presetNames,
  validate,
  summary,
  type Rules as Config,
  type RuleKey,
} from "../../../packages/rules/index";
const groups = ["Entry", "Dice", "Blocking", "Capturing", "Home", "Match"];
export function RulesStudio({
  rules,
  onChange,
  locked,
  onApply,
  onBack,
  pending = false,
  solo = false,
}: {
  rules: Config;
  onChange: (r: Config) => void;
  locked: boolean;
  onApply: () => void;
  onBack: () => void;
  pending?: boolean;
  solo?: boolean;
}) {
  const [base, setBase] = useState<Config["preset"]>(
      rules.preset === "custom" ? "don" : rules.preset,
    ),
    [group, setGroup] = useState("Entry");
  const errors = validate(rules);
  return (
    <section className="rules-screen">
      <div className="screen-title">
        <div>
          <span className="kicker">YOUR TABLE. YOUR RULES.</span>
          <h1>Match rules</h1>
        </div>
        <span className="pill">{locked ? "View only" : "House rules"}</span>
      </div>
      <div className="rules-workspace">
        <aside className="rules-nav">
          <label className="preset-label">
            Preset
            <select
              aria-label="Preset"
              disabled={locked || pending}
              value={rules.preset}
              onChange={(e) => {
                const id = e.target.value as Config["preset"];
                if (id !== "custom") setBase(id);
                onChange(
                  id === "custom"
                    ? { ...rules, preset: "custom" }
                    : {
                        ...preset(id),
                        players: rules.players,
                        timer: rules.timer,
                        visibility: rules.visibility,
                        slots: rules.slots,
                        mode: rules.mode,
                      },
                );
              }}
            >
              {Object.entries(presetNames).map(([id, n]) => (
                <option key={id} value={id}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <p className="subtle">
            Reference interpretations. House traditions vary.
          </p>
          <nav aria-label="Rule categories">
            {groups.map((g) => (
              <button
                key={g}
                className={group === g ? "selected" : ""}
                onClick={() => setGroup(g)}
              >
                {g}
                <span aria-hidden="true">→</span>
              </button>
            ))}
          </nav>
        </aside>
        <div className="rules-scroll" key={group}>
          <fieldset disabled={locked || pending}>
            <h2>{group}</h2>
            {Object.entries(fields)
              .filter(([, f]) => f.group === group)
              .map(([key, f]) => {
                const k = key as RuleKey;
                const update = (value: boolean | string | number) =>
                  onChange({ ...rules, preset: "custom", [k]: value });
                return (
                  <label key={key} className="rule-row">
                    <span>
                      <strong>{f.label}</strong>
                      <small>
                        {f.help
                          .replace(" Applies in Build 002.", "")
                          .replace(
                            "Public is labelled only; discovery is coming later.",
                            "Public discovery is unavailable.",
                          )}
                      </small>
                    </span>
                    {typeof f.value === "boolean" ? (
                      <input
                        type="checkbox"
                        role="switch"
                        checked={rules[k] as boolean}
                        onChange={(e) => update(e.target.checked)}
                      />
                    ) : key === "blockSize" || key === "maxBlock" ? (
                      <span className="range-control">
                        <output>{rules[k]}</output>
                        <input
                          aria-label={f.label}
                          type="range"
                          min={2}
                          max={4}
                          step={1}
                          value={rules[k] as number}
                          onChange={(e) => update(Number(e.target.value))}
                        />
                      </span>
                    ) : (
                      <select
                        value={String(rules[k])}
                        onChange={(e) =>
                          update(
                            typeof f.value === "number"
                              ? Number(e.target.value)
                              : e.target.value,
                          )
                        }
                      >
                        {"options" in f &&
                          f.options.map((v) => (
                            <option key={v} value={v}>
                              {v === 0 ? "Unlimited" : v}
                            </option>
                          ))}
                      </select>
                    )}
                  </label>
                );
              })}
            {group === "Match" &&
              Array.from({ length: rules.players }, (_, i) => (
                <label className="rule-row" key={i}>
                  <span>
                    <strong>
                      Seat {i + 1} · {["Red", "Green", "Gold", "Blue"][i]}
                    </strong>
                    <small>
                      {i === 0
                        ? "The host’s human seat."
                        : "The computer plays automatically using the same legal moves."}
                    </small>
                  </span>
                  <select
                    disabled={i === 0 || solo}
                    value={rules.slots[i]}
                    onChange={(e) => {
                      const slots = [...rules.slots];
                      slots[i] = e.target.value as "human" | "computer";
                      onChange({ ...rules, preset: "custom", slots });
                    }}
                  >
                    <option value="human">Human</option>
                    <option value="computer">Computer</option>
                  </select>
                </label>
              ))}
          </fieldset>
        </div>
      </div>
      {errors.length > 0 && (
        <div className="validation" role="alert">
          {errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}
      <div className="rules-save">
        <div>
          <strong>{presetNames[rules.preset]}</strong>
          <p>{summary(rules).split(" · ").slice(1).join(" · ")}</p>
        </div>
        <div className="button-row">
          {!locked && (
            <button
              className="ghost"
              disabled={pending}
              onClick={() =>
                onChange({
                  ...preset(base),
                  players: rules.players,
                  timer: rules.timer,
                  visibility: rules.visibility,
                  slots: rules.slots,
                  mode: rules.mode,
                })
              }
            >
              Reset preset
            </button>
          )}
          <button
            className="primary"
            disabled={pending || (!locked && errors.length > 0)}
            onClick={locked ? onBack : onApply}
          >
            {locked ? "Back" : pending ? "Saving…" : "Save & return"}{" "}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </section>
  );
}
