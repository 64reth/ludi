import {
  Icon,
  SkillIcon,
  SelectedIcon,
  DisclosureIcon,
  Coins,
  ChevronDown,
  X,
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Zap,
  Users,
  BookOpen,
  Scroll,
  Home,
  Shield,
  Footprints,
  Crosshair,
  Check,
  WifiOff,
  Target,
  TriangleAlert,
} from "./icons";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  currentPlayer,
  type Game,
  type Move,
} from "../../../packages/game-engine/index";
import { colours } from "../../../packages/shared/index";
import { effect, skills } from "../../../packages/war/index";
import { rangeHelp } from "../../../packages/war/guidance";
import { presetNames, summary } from "../../../packages/rules/index";
import { counterLabel } from "../../../packages/game-engine/events";
import type { Notice } from "../../../packages/presentation/notices";
import type { WarSelection } from "./useWarSelection";
import { MobileSheet } from "./MobileSheet";
import { WarPanel, WarBankSummary } from "./WarPanel";
import { WarHelp, type HelpPage } from "./WarHelp";
import { Dice } from "./Dice";
import { moveLabel } from "./GameTable";

type Sheet = "skills" | "players" | "rules" | "moves";
export function MobileGameTable({
  game,
  display,
  board,
  notice,
  canAct,
  busy,
  instruction,
  values,
  remaining,
  rolling,
  selection,
  target,
  select,
  clearSelection,
  shown,
  moves,
  onMove,
  onRoll,
  onPass,
  muted,
  onMute,
  flow,
  warOpen,
  setWarOpen,
  submitted,
  onSkill,
  cancelSkill,
  help,
  setHelp,
  history,
  deadlineText,
  online,
  connected,
  paused,
  accent,
}: {
  game: Game;
  display: Game;
  board: ReactNode;
  notice: ReactNode;
  canAct: boolean;
  busy: boolean;
  instruction: string;
  values: [number, number] | null;
  remaining: number[];
  rolling: boolean;
  selection?: number;
  target?: number;
  select: (i: number) => void;
  clearSelection: () => void;
  shown: Move[];
  moves: Move[];
  onMove: (id: string) => void;
  onRoll: () => void;
  onPass: () => void;
  muted: boolean;
  onMute: () => void;
  flow: WarSelection;
  warOpen: boolean;
  setWarOpen: (value: boolean) => void;
  submitted?: string;
  onSkill: (id: string) => void;
  cancelSkill: () => void;
  help?: HelpPage;
  setHelp: (page?: HelpPage) => void;
  history: Notice[];
  deadlineText?: string;
  online: boolean;
  connected: boolean;
  paused: boolean;
  accent: string;
}) {
  const [sheet, setSheet] = useState<Sheet>();
  const p = currentPlayer(display),
    w = display.war;
  const prepared = w?.prepared?.[p.id];
  const targeting = !!(
    warOpen &&
    !submitted?.startsWith("purchase:") &&
    flow.skill &&
    game.war?.prepared?.[currentPlayer(game).id] === flow.skill
  );
  useEffect(() => {
    // Deploying moves from the modal catalogue into a board-visible command dock.
    if (targeting) setSheet(undefined);
  }, [targeting]);
  useEffect(() => {
    if (!warOpen && sheet === "skills") setSheet(undefined);
  }, [warOpen]);
  useEffect(() => {
    if (paused) {
      setSheet(undefined);
      setHelp(undefined);
    }
  }, [paused]);
  useEffect(() => {
    if (target !== undefined && canAct) setSheet("moves");
  }, [target]);
  function closeSheet() {
    if (sheet === "skills") setWarOpen(false);
    setSheet(undefined);
  }
  function open(next: Sheet) {
    setHelp(undefined);
    setSheet(next);
    if (next === "skills") setWarOpen(true);
  }
  const shortInstruction = busy
    ? instruction
    : !canAct
      ? p.computer
        ? `${p.name} is thinking…`
        : `Waiting for ${p.name}.`
      : game.phase === "roll"
        ? "Roll both dice to begin."
        : selection === undefined
          ? "Select a counter to move."
          : "Tap a highlighted landing, or choose a move.";
  return (
    <div
      className={`mobile-table ${w ? "mobile-war" : "mobile-heritage"} ${targeting ? "is-targeting" : ""}`}
      style={{ "--active-player": accent } as CSSProperties}
      inert={paused}
      aria-busy={busy}
    >
      <section
        className="mobile-turn"
        aria-label="Current turn"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="mobile-turn-player">
          <strong>{colours[p.colour].toUpperCase()}’S TURN</strong>
          <span>
            {p.name} · {w ? `Round ${w.round}` : `Turn ${display.turn}`}{" "}
            {deadlineText && `· ${deadlineText}`}
          </span>
        </div>
        {w ? (
          <button
            className="mobile-bank"
            aria-haspopup="dialog"
            aria-expanded={sheet === "skills"}
            onClick={() => open("skills")}
            aria-label={`War Bank ${w.bank[p.id]} out of 12. Open skills`}
          >
            <strong>
              <Icon icon={Coins} size={14} /> Bank {w.bank[p.id]}/12{" "}
              <Icon icon={ChevronDown} size={14} />
            </strong>
            <span>
              {prepared ? (
                <>
                  <SkillIcon skill={prepared} size={12} />{" "}
                  {skills[prepared].name} prepared
                </>
              ) : (
                "No skill prepared"
              )}
            </span>
            <small>
              {w.window ? "Skill window open" : "Skill window closed"}
              {w.lock ? " · Heaven sealed" : ""}
            </small>
          </button>
        ) : (
          <span className="mobile-home-count">
            <Icon icon={Home} size={16} />{" "}
            {p.pieces.filter((v) => v === 56).length}/4 <small>home</small>
          </span>
        )}
      </section>
      <section className="mobile-board" aria-label="Game board">
        {board}
      </section>
      <section
        className="mobile-dock"
        aria-label={targeting ? "Skill targeting" : "Turn actions"}
      >
        {online && !connected && (
          <p className="mobile-connection" role="status">
            <Icon icon={WifiOff} /> Reconnecting… Your seat is reserved.
          </p>
        )}
        {targeting ? (
          <>
            <div className="mobile-target-heading">
              <div>
                <strong>
                  <SkillIcon skill={flow.skill!} /> {skills[flow.skill!].name}
                </strong>
                <span>Prepared · no extra cost</span>
              </div>
              <button aria-label="Cancel skill targeting" onClick={cancelSkill}>
                <Icon icon={X} />
              </button>
            </div>
            <SkillTargeting
              game={game}
              flow={flow}
              canAct={canAct}
              pending={!!submitted}
              onUse={onSkill}
              onCancel={cancelSkill}
            />
          </>
        ) : (
          <>
            <div
              className={`mobile-action-row ${canAct && game.phase === "roll" ? "before-roll" : "after-roll"}`}
            >
              <Dice
                muted={muted}
                onMute={onMute}
                values={values}
                remaining={remaining}
                rolling={rolling}
                disabled={!canAct || game.phase !== "roll"}
                onRoll={onRoll}
              />
              <div className="mobile-action-copy">
                <p role="status">{shortInstruction}</p>
                {canAct && game.phase === "move" && (
                  <>
                    <button
                      className="mobile-move-trigger"
                      onClick={() => open("moves")}
                    >
                      {shown.length} {shown.length === 1 ? "move" : "moves"}{" "}
                      available <Icon icon={ArrowUpRight} />
                    </button>
                  </>
                )}
                {canAct && game.phase === "roll" && w?.window && (
                  <button
                    className="mobile-prepare"
                    data-prepared={!!prepared}
                    onClick={() => open("skills")}
                  >
                    {prepared ? (
                      <SkillIcon skill={prepared} />
                    ) : (
                      <Icon icon={Zap} />
                    )}{" "}
                    {prepared ? "Deploy skill" : "Prepare skill"}
                  </button>
                )}
              </div>
            </div>
            <nav className="mobile-tools" aria-label="Table information">
              {w ? (
                <>
                  <button
                    aria-haspopup="dialog"
                    aria-expanded={sheet === "skills"}
                    onClick={() => open("skills")}
                  >
                    <Icon icon={Zap} />
                    Skills
                  </button>
                  <button
                    onClick={() => {
                      setSheet(undefined);
                      setHelp("key");
                    }}
                  >
                    <Icon icon={BookOpen} />
                    Battlefield
                  </button>
                </>
              ) : (
                <button
                  aria-haspopup="dialog"
                  aria-expanded={sheet === "rules"}
                  onClick={() => open("rules")}
                >
                  <Icon icon={BookOpen} />
                  Rules
                </button>
              )}
              <button
                aria-haspopup="dialog"
                aria-expanded={sheet === "players"}
                onClick={() => open("players")}
              >
                <Icon icon={Users} />
                Players
              </button>
              <button
                onClick={() => {
                  setSheet(undefined);
                  setHelp("events");
                }}
              >
                <Icon icon={Scroll} />
                Events
              </button>
            </nav>
          </>
        )}
      </section>
      <div className="mobile-event-strip">{notice}</div>
      {sheet && (
        <MobileSheet
          title={
            {
              skills: "Skills",
              players: "Players",
              rules: "Match Rules",
              moves: "Choose a move",
            }[sheet]
          }
          onClose={closeSheet}
          headerContent={
            sheet === "skills" && game.war ? (
              <WarBankSummary game={game} />
            ) : undefined
          }
        >
          {sheet === "skills" && game.war && (
            <WarPanel
              game={game}
              canAct={canAct}
              pending={!!submitted}
              flow={flow}
              onUse={onSkill}
              onClose={closeSheet}
            />
          )}
          {sheet === "players" && (
            <div className="mobile-player-list">
              {[...display.players]
                .sort((a, b) => a.colour - b.colour)
                .map((player) => (
                  <article
                    key={player.id}
                    aria-current={player.id === p.id ? "step" : undefined}
                  >
                    <span className={`mini-token ${colours[player.colour]}`}>
                      {player.colour + 1}
                    </span>
                    <div>
                      <h3>
                        {player.name}
                        {player.id === p.id ? " · playing" : ""}
                      </h3>
                      <p>
                        <Icon icon={Users} size={14} />{" "}
                        {player.computer ? "Computer" : "Human"}
                        {player.forfeited ? " · Left match" : ""} ·{" "}
                        {player.pieces.filter((v) => v === 56).length}/4 home
                      </p>
                      {w && (
                        <>
                          <p>
                            <Icon icon={Coins} size={14} /> Bank{" "}
                            {w.bank[player.id]}/12 ·{" "}
                            {w.prepared?.[player.id] ? (
                              <>
                                <SkillIcon
                                  skill={w.prepared[player.id]}
                                  size={14}
                                />{" "}
                                {skills[w.prepared[player.id]].name} prepared
                              </>
                            ) : (
                              "No skill prepared"
                            )}
                          </p>
                          {player.pieces.map((_, i) => {
                            const e = effect(display, {
                              owner: player.id,
                              piece: i,
                            });
                            return e &&
                              (e.shield || e.slow || e.danger !== undefined) ? (
                              <p key={i}>
                                Counter {i + 1}:{" "}
                                {e.shield ? (
                                  <>
                                    <Icon icon={Shield} size={14} /> Guard
                                    Up.{" "}
                                  </>
                                ) : (
                                  ""
                                )}
                                {e.slow ? (
                                  <>
                                    <Icon icon={Footprints} size={14} /> Slowed
                                    by up to {e.slow}.{" "}
                                  </>
                                ) : (
                                  ""
                                )}
                                {e.danger !== undefined && (
                                  <>
                                    <Icon icon={TriangleAlert} size={14} />{" "}
                                    Danger exposure.
                                  </>
                                )}
                              </p>
                            ) : null;
                          })}
                        </>
                      )}
                    </div>
                  </article>
                ))}
            </div>
          )}
          {sheet === "rules" && <RulesReadout game={display} />}
          {sheet === "moves" && (
            <div className="mobile-moves">
              <p>
                {selection === undefined
                  ? "All legal moves. Select a counter on the board to narrow these choices."
                  : `Moves for counter ${selection + 1}.`}
              </p>
              <div className="mobile-counters" aria-label="Choose counter">
                {p.pieces.map((v, i) => (
                  <button
                    key={i}
                    aria-label={`Select counter ${i + 1}`}
                    aria-pressed={selection === i}
                    disabled={!moves.some((m) => m.pieces.includes(i))}
                    onClick={() => {
                      select(i);
                      setSheet(undefined);
                    }}
                  >
                    {i + 1}
                    {v === 56 && <Icon icon={Home} size={12} />}
                    <SelectedIcon selected={selection === i} />
                  </button>
                ))}
              </div>

              {shown.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    onMove(m.id);
                    setSheet(undefined);
                  }}
                >
                  <Icon icon={m.captures.length ? Crosshair : Footprints} />{" "}
                  {moveLabel(game, m)} <Icon icon={ArrowRight} />
                </button>
              ))}
              <button
                className="secondary"
                onClick={() => {
                  clearSelection();
                  setSheet(undefined);
                }}
              >
                Choose on board
              </button>
              {!game.rules.useBoth && (
                <button
                  onClick={() => {
                    onPass();
                    setSheet(undefined);
                  }}
                >
                  End roll · forfeit unused dice
                </button>
              )}
            </div>
          )}
        </MobileSheet>
      )}
      {help && (
        <MobileSheet
          title={
            help === "key"
              ? "Battlefield"
              : help === "events"
                ? "Match Events"
                : "Welcome to War"
          }
          onClose={() => {
            if (help === "intro")
              try {
                localStorage.setItem("ludi.warIntroduction.v1", "done");
              } catch {}
            setHelp(undefined);
          }}
        >
          {display.war ? (
            <WarHelp
              page={help}
              game={display}
              history={history}
              onClose={() => setHelp(undefined)}
              onPage={setHelp}
            />
          ) : (
            <ol className="mobile-history">
              {[...display.events].reverse().map((event, i) => (
                <li key={event.id ?? i}>{event.text}</li>
              ))}
            </ol>
          )}
          {help === "key" && (
            <button
              className="secondary"
              onClick={() => {
                setHelp(undefined);
                setSheet("rules");
              }}
            >
              <Icon icon={BookOpen} /> Match rules
            </button>
          )}
        </MobileSheet>
      )}
    </div>
  );
}

function RulesReadout({ game }: { game: Game }) {
  const r = game.rules;
  return (
    <div className="mobile-rules">
      <h3>{presetNames[r.preset]}</h3>
      <p>{summary(r)}</p>
      <dl>
        {[
          ["Enter from yard", r.sixRequired ? "Roll a six" : "Open entry"],
          [
            "Dice use",
            r.useBoth ? "Use both dice when legal" : "May end a roll early",
          ],
          ["Finish", r.exactFinish ? "Exact total" : "Open finish"],
          [
            "Home entry",
            r.blockBeforeHome
              ? "Form a qualifying block first"
              : "No block required",
          ],
          ["Safe squares", r.safeSquares ? "Enabled" : "Disabled"],
          ["Game mode", r.mode === "war" ? "War" : "Heritage"],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <details>
        <summary>
          All house rules <DisclosureIcon />
        </summary>
        <dl>
          {Object.entries(r)
            .filter(([key]) => !["slots", "mode", "preset"].includes(key))
            .map(([key, value]) => (
              <div key={key}>
                <dt>
                  {key
                    .replace(/([A-Z])/g, " $1")
                    .replace(/^./, (c) => c.toUpperCase())}
                </dt>
                <dd>
                  {typeof value === "boolean"
                    ? value
                      ? "Yes"
                      : "No"
                    : String(value)}
                </dd>
              </div>
            ))}
        </dl>
      </details>
    </div>
  );
}

function SkillTargeting({
  game,
  flow,
  canAct,
  pending,
  onUse,
  onCancel,
}: {
  game: Game;
  flow: WarSelection;
  canAct: boolean;
  pending: boolean;
  onUse: (id: string) => void;
  onCancel: () => void;
}) {
  const instructions: Record<string, string> = {
    mode: "Advance your counter or slow an opponent?",
    source: "Select a highlighted counter of your colour.",
    target:
      "Select a highlighted opponent. Dimmed counters are out of range or protected.",
    second: "Add a second highlighted target, or confirm one.",
    distance: "Choose how far to advance.",
    confirm: "Review the highlighted outcome, then confirm.",
  };
  return (
    <div className="mobile-target-controls">
      <p role="status">
        {flow.problem && <Icon icon={TriangleAlert} size={16} />}{" "}
        {flow.problem ||
          (flow.skill === "lock"
            ? "No counter needed. Confirm to seal Heaven for all players."
            : instructions[flow.step])}
      </p>
      <details className="mobile-target-alternatives">
        <summary>
          Range and effect <DisclosureIcon />
        </summary>
        <p>{flow.skill && rangeHelp(flow.skill)}</p>
      </details>
      {flow.step === "mode" && (
        <div className="mobile-target-options">
          <button onClick={() => flow.setMode("forward")}>
            <Icon icon={Footprints} /> Fast Forward
          </button>
          <button onClick={() => flow.setMode("back")}>
            <Icon icon={Crosshair} /> Draw Back
          </button>
        </div>
      )}
      {flow.source && (
        <span className="mobile-target-selection">
          {counterLabel(game, flow.source.owner, flow.source.piece)}
          {flow.targets.length > 0 && (
            <>
              <Icon icon={ArrowRight} size={14} />{" "}
              {flow.targets
                .map((r) => counterLabel(game, r.owner, r.piece))
                .join(" + ")}
            </>
          )}
        </span>
      )}
      {flow.eligible.length > 0 && (
        <details className="mobile-target-alternatives">
          <summary>
            Choose counter by name <DisclosureIcon />
          </summary>
          <div className="mobile-target-options">
            {flow.eligible.map((r) => (
              <button
                key={`${r.owner}:${r.piece}`}
                onClick={() => flow.choose(r)}
              >
                <Icon icon={Target} size={16} />{" "}
                {counterLabel(game, r.owner, r.piece)}
              </button>
            ))}
          </div>
        </details>
      )}
      {flow.step === "distance" && (
        <div className="mobile-target-options">
          {flow.matching.map((a) => (
            <button
              key={a.id}
              aria-pressed={flow.choice?.id === a.id}
              onClick={() => flow.setChoice(a)}
            >
              <Icon icon={Footprints} /> Advance{" "}
              {a.to! - currentPlayer(game).pieces[a.source!.piece]}
              <SelectedIcon selected={flow.choice?.id === a.id} />
            </button>
          ))}
        </div>
      )}
      {flow.choice && (
        <p className="mobile-target-outcome">{flow.choice.label}</p>
      )}
      {!flow.choice &&
        flow.eligible.length === 0 &&
        !["mode", "distance"].includes(flow.step) && (
          <p>No legal target now. Hold your skill for a later turn.</p>
        )}
      <div className="mobile-target-actions">
        <button disabled={pending} onClick={onCancel}>
          <Icon icon={X} /> Cancel · hold
        </button>
        <button
          className="primary"
          disabled={!flow.choice || !canAct || pending}
          onClick={() => flow.choice && onUse(flow.choice.id)}
        >
          <Icon icon={Check} /> {pending ? "Confirming…" : "Confirm deployment"}
        </button>
      </div>
      {flow.step !== "source" && (
        <button
          className="mobile-target-back"
          disabled={pending}
          onClick={flow.back}
        >
          <Icon icon={ArrowLeft} /> Previous selection
        </button>
      )}
    </div>
  );
}
