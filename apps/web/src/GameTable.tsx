import {
  Icon,
  SkillIcon,
  SelectedIcon,
  Menu,
  Users,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Scroll,
  Coins,
  ChevronDown,
  ChevronUp,
  Zap,
  X,
  WifiOff,
  Bot,
  UserRound,
  Footprints,
  Crosshair,
  RotateCcw,
  Check,
} from "./icons";
import { MobileGameTable } from "./MobileGameTable";
import { useMobileLayout } from "./useMobileLayout";
import { WarHelp, needsWarIntro, type HelpPage } from "./WarHelp";
import { HelpTip } from "./HelpTip";
import { useWarFeedback } from "./useWarFeedback";
import { useWarSelection } from "./useWarSelection";
import { windowReason, unavailable } from "../../../packages/war/guidance";
import { skills, type Skill } from "../../../packages/war/index";
import { WarPanel } from "./WarPanel";
import type { SkillAction } from "../../../packages/war/index";
import {
  useEffect,
  useMemo,
  useState,
  useRef,
  type ReactNode,
  type CSSProperties,
} from "react";
import type { View } from "../../../packages/presentation/index";
import { Board } from "./Board";
import { Dice } from "./Dice";
import {
  currentPlayer,
  legalMoves,
  type Game,
  type Move,
} from "../../../packages/game-engine/index";
import { colours } from "../../../packages/shared/index";
function CommandContent({
  war,
  closed,
  children,
}: {
  war: boolean;
  closed: boolean;
  children: ReactNode;
}) {
  return war ? (
    <div className="command-content" inert={closed}>
      {children}
    </div>
  ) : (
    <>{children}</>
  );
}
export function moveLabel(g: Game, m: Move) {
  const dice = m.dice.map((i) => g.dice![i]).join(" + ");
  const who =
    m.pieces.length > 1
      ? `Block ${m.pieces.map((i) => i + 1).join(" + ")}`
      : `Counter ${m.pieces[0] + 1}`;
  const action =
    m.kind === "block"
      ? `Move ${g.dice![m.dice[0]]} on doubles`
      : `${m.kind === "enter" ? "Enter" : m.to === 56 ? "Finish" : "Move"} with ${dice}`;
  return `${who} · ${action}${m.captures.length ? " · Capture" : ""}${m.formsBlock ? " · Form block" : ""}${m.to === 50 && g.rules.blockBeforeHome ? " · Home gate" : m.to > 50 && m.to < 56 ? " · Home lane" : ""}`;
}
export function GameTable({
  game,
  gameError,
  introRequest = 0,
  presentation,
  presentationReady,
  playerId,
  online,
  connected,
  deadline,
  muted,
  onMute,
  onRoll,
  onSkill,
  onMove,
  onPass,
  onPause,
  onRules,
  paused,
}: {
  game: Game;
  gameError?: string;
  introRequest?: number;
  presentation: View;
  presentationReady: boolean;
  playerId?: string;
  online: boolean;
  connected: boolean;
  deadline?: number;
  muted: boolean;
  onMute: () => void;
  onRoll: () => void;
  onSkill: (id: string) => void;
  onMove: (id: string) => void;
  onPass: () => void;
  onPause: () => void;
  onRules: () => void;
  paused: boolean;
}) {
  const mobile = useMobileLayout();
  const [warOpen, setWarOpen] = useState(false),
    [help, setHelp] = useState<HelpPage | undefined>(() =>
      game.war && needsWarIntro() ? "intro" : undefined,
    ),
    [submitted, setSubmitted] = useState<string>();
  const feedback = useWarFeedback(game, gameError);
  const flow = useWarSelection(game, feedback.report);
  const skillPreview = warOpen ? flow.preview : undefined;
  const [noticeHover, setNoticeHover] = useState(false),
    [noticeFocus, setNoticeFocus] = useState(false);
  const noticeRegion = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!game.war) return;
    const sync = () => {
      setNoticeFocus(!!noticeRegion.current?.contains(document.activeElement));
      setNoticeHover(!!noticeRegion.current?.matches(":hover"));
    };
    sync();
    document.addEventListener("pointermove", sync, true);
    document.addEventListener("focusin", sync, true);
    document.addEventListener("focusout", sync, true);
    return () => {
      document.removeEventListener("pointermove", sync, true);
      document.removeEventListener("focusin", sync, true);
      document.removeEventListener("focusout", sync, true);
    };
  }, [!!game.war, feedback.view.current?.id]);
  useEffect(() => {
    feedback.queue.pause(paused || noticeHover || noticeFocus);
  }, [paused, noticeHover, noticeFocus, feedback.queue]);
  useEffect(() => {
    if (introRequest && game.war) {
      setHelp("intro");
      setWarOpen(false);
    }
  }, [introRequest]);
  useEffect(() => {
    if (
      submitted?.startsWith("purchase:") &&
      game.war?.prepared?.[currentPlayer(game).id]
    ) {
      setSubmitted(undefined);
      flow.reset();
    }
    if (submitted && game.war?.lastSkill?.revision === game.revision) {
      setSubmitted(undefined);
      setWarOpen(false);
      flow.reset();
    }
  }, [game.revision]);
  useEffect(() => {
    if (gameError) setSubmitted(undefined);
  }, [gameError]);
  const previousDrawer = useRef<"skills" | "help" | undefined>(undefined);
  useEffect(() => {
    if (warOpen || help) {
      previousDrawer.current = warOpen ? "skills" : "help";
      return;
    }
    if (previousDrawer.current) {
      const selector =
        previousDrawer.current === "skills"
          ? ".use-skill,.war-bank"
          : ".war-help-actions button";
      document.querySelector<HTMLElement>(selector)?.focus();
      previousDrawer.current = undefined;
    }
  }, [warOpen, !!help]);
  const [selection, select] = useState<number>(),
    [target, setTarget] = useState<number>(),
    [now, setNow] = useState(Date.now()),
    [intro, setIntro] = useState(true);
  const display = presentation.game ?? game,
    p = currentPlayer(display),
    stage = presentation.stage,
    active = presentation.active;
  const busy = !presentationReady;
  const canAct =
    !paused &&
    !busy &&
    help !== "intro" &&
    game.phase !== "finished" &&
    !currentPlayer(game).computer &&
    (!online || (connected && currentPlayer(game).id === playerId));
  const moves = useMemo(
    () => (canAct && game.phase === "move" ? legalMoves(game) : []),
    [game, canAct],
  );
  useEffect(() => {
    select(undefined);
    setTarget(undefined);
  }, [game.revision, game.match]);
  useEffect(() => {
    setIntro(true);
    const timer = setTimeout(() => setIntro(false), 650);
    return () => clearTimeout(timer);
  }, [game.match]);
  useEffect(() => {
    if (!deadline) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [deadline]);
  const shown = moves.filter(
    (m) =>
      (selection === undefined || m.pieces.includes(selection)) &&
      (target === undefined || m.to === target),
  );
  const instruction = busy
    ? presentation.announcement || "Finishing the move…"
    : display.phase === "roll"
      ? p.computer
        ? "Computer is thinking…"
        : canAct
          ? display.war
            ? `${windowReason(display)}${display.war.bank[p.id] < 3 ? " Roll to earn points; the cheapest first skill costs 3." : ""}`
            : "Roll both dice to start your move."
          : `Waiting for ${p.name} to roll.`
      : p.computer
        ? "Computer is thinking…"
        : canAct
          ? target !== undefined
            ? "Choose which dice to use for this landing."
            : selection !== undefined
              ? "Select a highlighted square, or choose dice below."
              : "Choose a counter. Its legal destinations will light up."
          : `${p.name} is choosing a counter.`;
  const diceActive = active && ["dice", "dice-result"].includes(stage);
  const values = diceActive ? active.to.dice : display.dice;
  const remaining = diceActive ? [0, 1] : display.remaining;
  const colour = colours[p.colour];
  const accent = ["#de6954", "#6eb87a", "#f2c541", "#6aaed0"][p.colour];
  const ordered = [...display.players].sort((a, b) => a.colour - b.colour);
  const board = (
    <Board
      game={display}
      skillPreview={skillPreview}
      skillActions={mobile && warOpen && canAct ? flow.matching : undefined}
      skillCandidates={warOpen && canAct ? flow.eligible : undefined}
      onSkillPiece={warOpen && canAct ? (r) => flow.choose(r) : undefined}
      moves={moves}
      selectedPiece={selection}
      onPiece={(i) => {
        select(i);
        setTarget(undefined);
      }}
      onDestination={(actions) => {
        if (!canAct) return;
        if (actions.length === 1) onMove(actions[0].id);
        else setTarget(actions[0].to);
      }}
      canAct={canAct}
      seat={p.colour}
      safeSquares={display.rules.safeSquares}
      presentation={presentation}
      motionPaused={paused}
    />
  );
  const notice = display.war ? (
    <div
      ref={noticeRegion}
      className="war-notice"
      data-tone={feedback.view.current?.tone || "ordinary"}
      onMouseEnter={() => setNoticeHover(true)}
      onMouseLeave={() => setNoticeHover(false)}
      onFocusCapture={() => setNoticeFocus(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setNoticeFocus(false);
      }}
    >
      <p role="status" aria-live="polite">
        <span className="notice-context">
          {feedback.view.current?.round
            ? `Round ${feedback.view.current.round} · match event`
            : "Match event"}
        </span>
        {feedback.view.current?.text ||
          "War: choose Battlefield Key for symbols, or Match Events to review the action."}
      </p>
      {feedback.view.current && (
        <button
          className="text-button"
          onClick={feedback.queue.dismiss}
          aria-label="Dismiss match notification"
        >
          {feedback.view.waiting
            ? `Next (${feedback.view.waiting})`
            : "Dismiss"}{" "}
          <Icon icon={feedback.view.waiting ? ArrowRight : X} size={14} />
        </button>
      )}
    </div>
  ) : (
    presentation.message || display.events.at(-1)?.text
  );
  if (mobile)
    return (
      <MobileGameTable
        game={game}
        display={display}
        board={board}
        notice={notice}
        canAct={canAct}
        busy={busy}
        instruction={instruction}
        values={values}
        remaining={remaining}
        rolling={stage === "dice"}
        selection={selection}
        target={target}
        select={(i) => {
          select(selection === i ? undefined : i);
          setTarget(undefined);
        }}
        clearSelection={() => {
          select(undefined);
          setTarget(undefined);
        }}
        shown={shown}
        moves={moves}
        onMove={onMove}
        onPass={onPass}
        onRoll={() => {
          setWarOpen(false);
          flow.reset();
          onRoll();
        }}
        muted={muted}
        onMute={onMute}
        flow={flow}
        warOpen={warOpen}
        setWarOpen={setWarOpen}
        submitted={submitted}
        onSkill={(id) => {
          setSubmitted(id);
          onSkill(id);
        }}
        cancelSkill={() => {
          setWarOpen(false);
          flow.reset();
          setSubmitted(undefined);
        }}
        help={help}
        setHelp={setHelp}
        history={feedback.view.history}
        deadlineText={
          deadline
            ? `${Math.max(0, Math.ceil((deadline - now) / 1000))}s`
            : undefined
        }
        online={online}
        connected={connected}
        paused={paused}
        accent={accent}
      />
    );
  return (
    <div
      className={`table-screen playable-table clarity-table ${display.war ? "war-table" : ""} ${paused ? "presentation-paused" : ""}`}
      style={{ "--active-player": accent } as CSSProperties}
      inert={paused}
      aria-busy={busy}
    >
      <aside className="table-console command-area">
        <CommandContent war={!!display.war} closed={warOpen || !!help}>
          <div className={`turn-status active-${colour}`}>
            <span className="kicker">CURRENT TURN</span>
            <h1>{colour.toUpperCase()}'S TURN</h1>
            <div className="active-identity">
              <strong>{p.name}</strong>
              <span className="player-kind">
                <Icon icon={p.computer ? Bot : UserRound} size={14} />{" "}
                {p.computer ? "Computer" : "Human"}
              </span>
            </div>
            <span className="pill">
              {deadline
                ? `${Math.max(0, Math.ceil((deadline - now) / 1000))}s · `
                : ""}
              {display.war ? `War · Round ${display.war.round} · ` : ""}Turn{" "}
              {display.turn} · {p.pieces.filter((v) => v !== 56).length} to home
            </span>
            {display.war && (
              <button
                className="war-bank"
                aria-expanded={warOpen}
                aria-label={`War Bank ${display.war.bank[p.id]} out of 12. Open skills`}
                onClick={() => {
                  setWarOpen(!warOpen);
                  setHelp(undefined);
                }}
              >
                <Icon icon={Coins} /> War Bank{" "}
                <strong>{display.war.bank[p.id]}/12</strong>
                <small>{display.war.window ? "Open" : "Closed"}</small>
                <Icon icon={warOpen ? ChevronUp : ChevronDown} size={14} />
              </button>
            )}
          </div>
          <div
            className="turn-order"
            role="list"
            aria-label="Clockwise turn order"
          >
            {ordered.map((r) => (
              <div
                role="listitem"
                key={r.id}
                className={r.id === p.id ? "current-racer" : ""}
                aria-current={r.id === p.id ? "step" : undefined}
              >
                <span className={`mini-token ${colours[r.colour]}`}>
                  {r.colour + 1}
                </span>
                <span title={r.name}>
                  {r.name}
                  {r.forfeited ? " · Left" : ""}
                  {display.war && (
                    <small className="prepared-summary">
                      {display.war.prepared?.[r.id] ? (
                        <>
                          <SkillIcon
                            skill={display.war.prepared[r.id]}
                            size={12}
                          />{" "}
                          {skills[display.war.prepared[r.id]].name} ready
                        </>
                      ) : (
                        "No skill prepared"
                      )}
                    </small>
                  )}
                </span>
                <small>{r.pieces.filter((v) => v === 56).length}/4</small>
              </div>
            ))}
          </div>
          <Dice
            muted={muted}
            onMute={onMute}
            values={values}
            remaining={remaining}
            disabled={!canAct || game.phase !== "roll"}
            rolling={stage === "dice"}
            onRoll={() => {
              setWarOpen(false);
              flow.reset();
              onRoll();
            }}
            label={
              busy
                ? stage === "travel"
                  ? "Counter moving…"
                  : stage === "resolve"
                    ? "Resolving move…"
                    : "Watch the table…"
                : display.phase === "move"
                  ? "Choose a counter"
                  : p.computer
                    ? "Computer is thinking…"
                    : "Roll dice"
            }
          />
          <div className="move-command">
            {display.war && (
              <div
                className={`war-turn-decision ${display.war.window ? "window-open" : "window-closed"}`}
              >
                <div className="guidance-heading">
                  <strong>
                    {display.war.window
                      ? `War Bank: ${display.war.bank[p.id]}/12`
                      : "Skill window closed"}
                  </strong>
                  <HelpTip label="bank and skill window">
                    Earn half the dice total, rounded up, capped at 12; overflow
                    is lost. Buy one skill to hold or deploy before your first
                    roll. Bonus rolls do not reopen this window. Unspent points
                    persist.
                  </HelpTip>
                </div>
                {canAct && display.war.window ? (
                  <>
                    <p className="pre-roll-prompt">
                      Prepare, deploy, or roll. Holding a skill is always
                      allowed.
                    </p>
                    <button
                      className="primary use-skill"
                      onClick={() => {
                        setWarOpen(true);
                        setHelp(undefined);
                      }}
                    >
                      <Icon icon={Zap} />{" "}
                      {display.war.prepared?.[p.id]
                        ? "Deploy Prepared Skill"
                        : "Prepare Skill"}
                    </button>
                    {!Object.keys(skills).some(
                      (s) => !unavailable(game, s as Skill),
                    ) && (
                      <p className="skill-no-options">
                        {display.war.bank[p.id] < 3
                          ? "Not enough points yet. Roll to build your bank; first skills start at 3."
                          : "No skill available now. You can hold your prepared skill and roll normally."}
                      </p>
                    )}
                  </>
                ) : (
                  <p>{windowReason(display)}</p>
                )}
              </div>
            )}
            <p
              className={`move-instructions ${display.war?.window && canAct ? "decision-instructions" : ""} ${busy ? "sequence-instructions" : ""}`}
            >
              {display.war && !display.war.window && display.phase === "move"
                ? "Skills closed. "
                : ""}
              {instruction}
            </p>
            {display.phase === "move" && canAct && (
              <>
                <div className="counter-picker" aria-label="Choose counter">
                  {p.pieces.map((v, i) => (
                    <button
                      key={i}
                      aria-pressed={selection === i}
                      disabled={!moves.some((m) => m.pieces.includes(i))}
                      onClick={() => {
                        select(selection === i ? undefined : i);
                        setTarget(undefined);
                      }}
                    >
                      {i + 1}
                      {v === 56 && <Icon icon={Check} size={12} />}
                      <SelectedIcon selected={selection === i} />
                    </button>
                  ))}
                </div>
                <div className="move-choices" aria-label="Legal moves">
                  {shown.map((m) => (
                    <button
                      className="move-choice"
                      key={m.id}
                      onClick={() => onMove(m.id)}
                    >
                      <Icon
                        icon={m.captures.length ? Crosshair : Footprints}
                        size={16}
                      />{" "}
                      {moveLabel(game, m)} <Icon icon={ArrowRight} />
                    </button>
                  ))}
                </div>
                {(selection !== undefined || target !== undefined) && (
                  <button
                    className="text-button"
                    onClick={() => {
                      select(undefined);
                      setTarget(undefined);
                    }}
                  >
                    Show all legal moves
                  </button>
                )}
                {!game.rules.useBoth && (
                  <button className="ghost" onClick={onPass}>
                    End roll · forfeit unused dice
                  </button>
                )}
              </>
            )}
          </div>
          {display.war && (
            <nav className="war-help-actions" aria-label="War help">
              <button
                className="text-button"
                onClick={() => {
                  setHelp(help === "key" ? undefined : "key");
                  setWarOpen(false);
                }}
              >
                <Icon icon={BookOpen} /> Battlefield Key
              </button>
              <button
                className="text-button"
                aria-expanded={help === "events"}
                onClick={() => {
                  setHelp(help === "events" ? undefined : "events");
                  setWarOpen(false);
                }}
              >
                <Icon icon={Scroll} /> Match Events (
                {feedback.view.history.length})
              </button>
            </nav>
          )}
          <div className="table-essential">
            <button className="secondary" onClick={onRules}>
              <Icon icon={BookOpen} /> Match rules <Icon icon={ArrowUpRight} />
            </button>
            <button className="ghost" onClick={onPause}>
              <Icon icon={Menu} /> Pause / menu
            </button>
          </div>
          {online && !connected && (
            <p className="connection-note">
              <Icon icon={WifiOff} /> Reconnecting… Your seat is reserved.
            </p>
          )}
        </CommandContent>
        {warOpen && display.war && (
          <WarPanel
            game={game}
            canAct={canAct}
            pending={!!submitted}
            flow={flow}
            onUse={(id) => {
              setSubmitted(id);
              onSkill(id);
            }}
            onClose={() => {
              setWarOpen(false);
              flow.reset();
              setSubmitted(undefined);
            }}
          />
        )}
        {help && display.war && (
          <WarHelp
            key={help}
            page={help}
            game={display}
            history={feedback.view.history}
            onPage={setHelp}
            onClose={() => setHelp(undefined)}
          />
        )}
      </aside>
      <section className="table-stage">
        <div className="table-player-bar">
          <span>
            <i className="status-light" />
            {p.name.toUpperCase()} · {p.computer ? "COMPUTER" : "HUMAN"}
          </span>
          <span>
            {display.war?.lock
              ? "HEAVEN SEALED · TAP ▣"
              : display.rules.blockBeforeHome
                ? p.homeUnlocked
                  ? "HOME UNLOCKED"
                  : "FORM A HOME-ENTRY BLOCK"
                : display.rules.exactFinish
                  ? "EXACT FINISH"
                  : "OPEN FINISH"}
          </span>
        </div>
        <div className="table-board">
          {board}
          {(stage === "turn" || intro) && (
            <div
              className="turn-announcement"
              key={`${game.match}:${display.turn}`}
            >
              <strong>{colour.toUpperCase()}'S TURN</strong>
              <span>
                {p.name} · {p.computer ? "Computer" : "Human"}
              </span>
            </div>
          )}
        </div>
        <div
          className={`table-feedback ${active?.captured.length && stage === "resolve" ? "capture-feedback" : ""}`}
        >
          {notice}
        </div>
      </section>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {(display.war ? "" : presentation.announcement) ||
          `${colour}'s turn. ${p.name}. ${p.computer ? "Computer" : "Human"}.`}
      </p>
    </div>
  );
}
export function Results({
  game,
  online,
  voted,
  votes,
  onRematch,
  onMenu,
  onLobby,
  host,
}: {
  game: Game;
  online: boolean;
  voted: boolean;
  votes: number;
  onRematch: () => void;
  onMenu: () => void;
  onLobby: () => void;
  host: boolean;
}) {
  const winner = game.players.find((p) => p.id === game.winnerId);
  return (
    <section className="results-screen">
      <span className="kicker">
        {game.war ? "WAR · VICTORY" : "HERITAGE · THE TABLE HAS A WINNER"}
      </span>
      <span className={`winner-token ${colours[winner?.colour ?? 0]}`}>♛</span>
      <h1>{winner?.name || "Match"} wins!</h1>
      <p>
        {winner?.pieces.every((v) => v === 56)
          ? "All four counters home. Well played."
          : "The other players left the match."}
      </p>
      <div className="result-scores">
        {game.players.map((p) => (
          <article key={p.id}>
            <span className={`mini-token ${colours[p.colour]}`}>
              {p.colour + 1}
            </span>
            <strong>{p.name}</strong>
            <span>{p.pieces.filter((v) => v === 56).length}/4 home</span>
            <small>
              {p.captures} captures · {p.blocks} blocks
            </small>
          </article>
        ))}
      </div>
      <div className="button-row">
        <button
          className="primary"
          disabled={online && voted}
          onClick={onRematch}
        >
          {online && voted ? `Rematch requested · ${votes} ready` : "Rematch"}{" "}
          <Icon icon={RotateCcw} />
        </button>
        {online && host && (
          <button className="secondary" onClick={onLobby}>
            <Icon icon={Users} /> Return to lobby
          </button>
        )}
        <button className="ghost" onClick={onMenu}>
          <Icon icon={Menu} /> Return to main menu
        </button>
      </div>
      {online && (
        <p className="subtle">Everyone at the table must agree to a rematch.</p>
      )}
    </section>
  );
}
