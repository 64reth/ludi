import { useEffect, useRef } from "react";
import {
  skills,
  cost,
  type Ref,
  type Skill,
} from "../../../packages/war/index";
import {
  unavailable,
  rangeHelp,
  abilityDescription,
  sameRef,
  windowReason,
} from "../../../packages/war/guidance";
import { currentPlayer, type Game } from "../../../packages/game-engine/index";
import { counterLabel } from "../../../packages/game-engine/events";
import type { WarSelection } from "./useWarSelection";
import { HelpTip } from "./HelpTip";
export function WarPanel({
  game,
  canAct,
  onUse,
  onClose,
  flow,
  pending,
}: {
  game: Game;
  canAct: boolean;
  onUse: (id: string) => void;
  onClose: () => void;
  flow: WarSelection;
  pending: boolean;
}) {
  const w = game.war!,
    p = currentPlayer(game),
    { skill, choice } = flow;
  const confirmation = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    panel.current?.focus();
  }, []);
  useEffect(() => {
    if (choice)
      confirmation.current?.scrollIntoView({
        block: "nearest",
        behavior: "instant",
      });
  }, [choice?.id]);
  const stepText =
    flow.step === "skill"
      ? "1 · Choose a skill"
      : flow.step === "mode"
        ? "2 · Choose advance or slow"
        : flow.step === "source"
          ? skill === "tempo"
            ? "3 · Choose your counter"
            : "2 · Choose your counter"
          : flow.step === "target"
            ? "3 · Choose an opposing target"
            : flow.step === "second"
              ? "3 · Add a second target, or confirm just one"
              : flow.step === "distance"
                ? "4 · Choose the extra distance"
                : skill === "lock"
                  ? "2 · Preview, then confirm · no counter needed"
                  : skill === "guard"
                    ? "3 · Preview, then confirm"
                    : skill === "tempo" && flow.mode === "forward"
                      ? "5 · Preview, then confirm"
                      : "4 · Preview, then confirm";
  const refName = (r: Ref) => counterLabel(game, r.owner, r.piece);
  return (
    <section
      ref={panel}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
      className="war-panel war-drawer"
      aria-label="War skill selection"
    >
      <header>
        <div>
          <span className="kicker">WAR · ROUND {w.round}</span>
          <h2>
            War Bank: {w.bank[p.id]}/12{" "}
            <HelpTip label="War Bank cap">
              Both dice add their total face values. Your shared bank holds at
              most 12; overflow is discarded. Unspent points persist. Purchases
              are immediate, and each skill’s price rises by 3 up to 12.
            </HelpTip>
          </h2>
        </div>
        <button
          className="ghost"
          onClick={onClose}
          aria-label="Close skill selection"
        >
          ×
        </button>
      </header>
      <p className="skill-guidance">
        {canAct
          ? windowReason(game)
          : `Watching ${p.name}. Only the current human player can deploy a skill before rolling.`}
      </p>
      {flow.problem && (
        <p className="skill-unavailable" role="alert">
          {flow.problem} Nothing has been spent.
        </p>
      )}
      <p className="skill-step" aria-live="polite">
        {stepText}
      </p>
      {!skill ? (
        <div className="war-skills">
          {(Object.keys(skills) as Skill[]).map((s) => (
            <div key={s} className="skill-card">
              <button
                aria-label={`Choose ${skills[s].name}`}
                onClick={() => flow.selectSkill(s)}
              >
                <strong>
                  {skills[s].name} · {cost(game, s)} points
                </strong>
                <small>
                  {unavailable(game, s) || "Available before rolling"}
                </small>
              </button>
              <HelpTip label={skills[s].name}>{abilityDescription(s)}</HelpTip>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="selected-skill-heading">
            <h3>
              {skills[skill].name} · {cost(game, skill)} points
            </h3>
            <HelpTip label="skill price and range">
              {abilityDescription(skill)}
            </HelpTip>
          </div>
          <p>{rangeHelp(skill)}</p>
          {unavailable(game, skill) && (
            <p className="skill-unavailable" role="status">
              {unavailable(game, skill)}
            </p>
          )}
          {!unavailable(game, skill) && (
            <div className="war-targets">
              {flow.step === "mode" && (
                <div className="button-row">
                  <button
                    className="secondary"
                    disabled={!canAct}
                    onClick={() => flow.setMode("forward")}
                  >
                    Fast Forward · your counter
                  </button>
                  <button
                    className="secondary"
                    disabled={!canAct}
                    onClick={() => flow.setMode("back")}
                  >
                    Draw Back · opponent
                  </button>
                </div>
              )}
              {flow.source && <p>Selected: {refName(flow.source)}</p>}
              {flow.targets.length > 0 && (
                <p>Targets: {flow.targets.map(refName).join(" + ")}</p>
              )}
              {flow.eligible.length > 0 && (
                <>
                  <p>
                    Tap a highlighted counter on the board, or choose below.
                  </p>
                  <div className="skill-counter-list">
                    {flow.eligible.map((r) => (
                      <button
                        key={`${r.owner}:${r.piece}`}
                        className="skill-counter-option"
                        disabled={!canAct}
                        onClick={() => flow.choose(r)}
                      >
                        {refName(r)}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {flow.step === "distance" &&
                flow.matching.map((a) => (
                  <button
                    className="skill-distance-option"
                    key={a.id}
                    disabled={!canAct}
                    aria-pressed={choice?.id === a.id}
                    onClick={() => flow.setChoice(a)}
                  >
                    Advance{" "}
                    {a.to! - game.players[game.current].pieces[a.source!.piece]}{" "}
                    {a.to! -
                      game.players[game.current].pieces[a.source!.piece] ===
                    1
                      ? "space"
                      : "spaces"}
                  </button>
                ))}
              {choice && (
                <div className="skill-confirm" ref={confirmation}>
                  <strong>{choice.label}</strong>
                  {skill === "double" && choice.targets.length === 1 && (
                    <p>
                      Single-target Double Cut: only this counter will be sent
                      to the Yard. The price stays {choice.cost}.
                    </p>
                  )}
                  <p>
                    Spend {choice.cost} now → bank {w.bank[p.id] - choice.cost}
                    /12. Next purchase of this skill:{" "}
                    {Math.min(12, choice.cost + 3)} points.
                  </p>
                  <button
                    className="primary"
                    disabled={!canAct || pending}
                    onClick={() => onUse(choice.id)}
                  >
                    {pending
                      ? "Waiting for table confirmation…"
                      : `Confirm ${skills[skill].name} · ${choice.cost} points`}
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="skill-navigation">
            <button
              className="secondary"
              onClick={flow.back}
              disabled={pending}
            >
              ← Back
            </button>
            <button className="ghost" onClick={onClose} disabled={pending}>
              Cancel · spend nothing
            </button>
          </div>
        </>
      )}
      {pending && (
        <p role="status">
          Validating the action. Points are deducted only after the table
          accepts it.
        </p>
      )}
    </section>
  );
}
