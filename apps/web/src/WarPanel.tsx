import {
  Icon,
  SkillIcon,
  SelectedIcon,
  Coins,
  X,
  TriangleAlert,
  Check,
  Zap,
  ArrowLeft,
  Footprints,
  Crosshair,
  Target,
  LockKeyhole,
} from "./icons";
import { useEffect, useRef } from "react";
import {
  skills,
  cost,
  purchaseReason,
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
  const stepText = !w.prepared?.[p.id]
    ? skill
      ? "Confirm purchase · no target required"
      : "Choose a skill to prepare"
    : flow.step === "skill"
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
            <WarBankSummary game={game} />
          </h2>
        </div>
        <button
          className="ghost"
          onClick={onClose}
          aria-label="Close skill selection"
        >
          <Icon icon={X} />
        </button>
      </header>
      <p className="skill-guidance">
        {canAct
          ? windowReason(game)
          : `Watching ${p.name}. Only the current human player can deploy a skill before rolling.`}
      </p>
      {flow.problem && (
        <p className="skill-unavailable" role="alert">
          <Icon icon={TriangleAlert} /> {flow.problem} Your prepared skill is
          still held.
        </p>
      )}
      <p className="skill-step" aria-live="polite">
        {stepText}
      </p>
      {!w.prepared?.[p.id] ? (
        <div className="war-skills">
          {(Object.keys(skills) as Skill[]).map((s) => {
            const reason =
              purchaseReason(game, s) ||
              (pending
                ? "Waiting for table confirmation."
                : !canAct
                  ? "Available on your turn before rolling."
                  : "");
            return (
              <div
                key={s}
                className="skill-card"
                data-availability={
                  reason
                    ? "unavailable"
                    : skill === s
                      ? "selected"
                      : "available"
                }
              >
                <button
                  aria-label={`Choose ${skills[s].name}`}
                  aria-pressed={skill === s}
                  disabled={!canAct || pending || !!purchaseReason(game, s)}
                  onClick={() => flow.selectSkill(s)}
                >
                  <strong>
                    <SkillIcon skill={s} /> {skills[s].name} · {cost(game, s)}{" "}
                    points <SelectedIcon selected={skill === s} />
                  </strong>
                  <small>
                    {reason ? (
                      <>
                        <Icon icon={LockKeyhole} size={12} /> Unavailable ·{" "}
                        {reason}
                      </>
                    ) : (
                      "Purchase and hold; no target required"
                    )}
                  </small>
                </button>
                {skill === s && (
                  <div className="skill-confirm">
                    <p>
                      Spend {cost(game, s)} now; bank{" "}
                      {w.bank[p.id] - cost(game, s)}/12. Keep this skill until
                      deployed. Next purchase: {Math.min(12, cost(game, s) + 3)}
                      .
                    </p>
                    <button
                      disabled={!canAct || pending || !!purchaseReason(game, s)}
                      onClick={() => onUse(`purchase:${s}`)}
                    >
                      <Icon icon={Check} /> Confirm Purchase · {skills[s].name}
                    </button>
                  </div>
                )}
                <HelpTip label={skills[s].name}>
                  {abilityDescription(s)}
                </HelpTip>
              </div>
            );
          })}
        </div>
      ) : !skill ? (
        <div>
          <p>
            <SkillIcon skill={w.prepared[p.id]} />{" "}
            {skills[w.prepared[p.id]].name} ready. Hold it for a later turn, or
            deploy now.
          </p>
          <button
            disabled={
              !canAct || pending || !!unavailable(game, w.prepared[p.id])
            }
            onClick={() => flow.selectSkill(w.prepared![p.id])}
          >
            <Icon icon={Zap} /> Deploy Prepared Skill
          </button>
          <p>{unavailable(game, w.prepared[p.id])}</p>
          <button className="ghost" onClick={onClose}>
            <Icon icon={ArrowLeft} /> Hold · return to dice
          </button>
        </div>
      ) : (
        <>
          <div className="selected-skill-heading">
            <h3>
              <SkillIcon skill={skill} /> {skills[skill].name} · prepared
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
                    <Icon icon={Footprints} /> Fast Forward · your counter
                  </button>
                  <button
                    className="secondary"
                    disabled={!canAct}
                    onClick={() => flow.setMode("back")}
                  >
                    <Icon icon={Crosshair} /> Draw Back · opponent
                  </button>
                </div>
              )}
              {flow.source && (
                <p>
                  <Icon icon={Target} /> Selected: {refName(flow.source)}
                </p>
              )}
              {flow.targets.length > 0 && (
                <p>
                  <Icon icon={Crosshair} /> Targets:{" "}
                  {flow.targets.map(refName).join(" + ")}
                </p>
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
                        <Icon icon={Target} size={16} /> {refName(r)}
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
                    <Icon icon={Footprints} /> Advance{" "}
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
                      to the Yard. Your prepared skill will be consumed.
                    </p>
                  )}
                  <p>
                    Deploy your prepared skill. No further points are charged;
                    your slot becomes empty.
                  </p>
                  <button
                    className="primary"
                    disabled={!canAct || pending}
                    onClick={() => onUse(choice.id)}
                  >
                    <Icon icon={Check} />{" "}
                    {pending
                      ? "Waiting for table confirmation…"
                      : `Confirm Deployment · ${skills[skill].name}`}
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
              <Icon icon={ArrowLeft} /> Back
            </button>
            <button className="ghost" onClick={onClose} disabled={pending}>
              <Icon icon={ArrowLeft} /> Hold · return to dice
            </button>
          </div>
        </>
      )}
      {pending && <p role="status">Validating the action with the table.</p>}
    </section>
  );
}

/** The same balance/help content is used in the desktop drawer and fixed mobile header. */
export function WarBankSummary({ game }: { game: Game }) {
  const player = currentPlayer(game);
  return (
    <>
      <Icon icon={Coins} /> War Bank: {game.war!.bank[player.id]}/12{" "}
      <HelpTip label="War Bank cap">
        Each roll earns half the dice total, rounded up. Your shared bank holds
        at most 12; overflow is discarded. Unspent points persist. Purchases are
        immediate, and each skill’s price rises by 3 up to 12.
      </HelpTip>
    </>
  );
}
