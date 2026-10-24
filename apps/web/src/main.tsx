import {
  Icon,
  SelectedIcon,
  Zap,
  Menu,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Settings,
  X,
  Volume2,
  VolumeX,
  BookOpen,
  Users,
  Wifi,
  WifiOff,
  Plus,
  LogIn,
  LogOut,
  Check,
  Copy,
  CircleCheck,
  Clock,
  Bot,
  UserRound,
  TriangleAlert,
  Play,
  RotateCcw,
} from "./icons";
import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Board } from "./Board";
import { GameTable, Results } from "./GameTable";
import { LocalSetup } from "./LocalSetup";
import { useLocalMatch } from "./useLocalMatch";
import { usePresentation, useReducedMotion, loadPace } from "./usePresentation";
import { useGameAudio } from "./useGameAudio";
import type { Pace } from "../../../packages/presentation/index";
import { RulesStudio } from "./Rules";
import { useLobby } from "./useLobby";
import {
  preset,
  presetNames,
  validate,
  summary,
  type Rules,
} from "../../../packages/rules/index";
import { colours } from "../../../packages/shared/index";
import "./style.css";
import "./mobile-game.css";
import "./icons.css";
const inspectorEnabled =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_INSPECTOR === "true";
const Inspector = inspectorEnabled
  ? lazy(() => import("./Inspector"))
  : undefined;
type Screen =
  | "menu"
  | "play"
  | "online"
  | "create"
  | "join"
  | "lobby"
  | "table"
  | "rules"
  | "settings"
  | "pause"
  | "localsetup"
  | "results";
function load(): Rules {
  try {
    const r = JSON.parse(localStorage.getItem("ludi.rules.v1") || "null");
    return validate(r, false).length ? preset("don") : r;
  } catch {
    return preset("don");
  }
}
function App() {
  const [screen, setScreen] = useState<Screen>("menu"),
    [rules, setRules] = useState(load),
    [draft, setDraft] = useState<Rules>(rules),
    [pending, setPending] = useState(false),
    [name, setName] = useState(""),
    [code, setCode] = useState(""),
    [copied, setCopied] = useState(false),
    [muted, setMuted] = useState(() => {
      try {
        return localStorage.getItem("ludi.sound") !== "on";
      } catch {
        return true;
      }
    }),
    [confirm, setConfirm] = useState<"leave" | "discard" | null>(null),
    [feedback, setFeedback] = useState(
      "Select a counter to take a closer look.",
    ),
    [inspectorOpen, setInspectorOpen] = useState(false),
    [inspection, setInspection] = useState(""),
    [stack, setStack] = useState(false),
    [boardKey, setBoardKey] = useState(0);
  const [onlineEnabled, setOnlineEnabled] = useState(false);
  const [setupMode, setSetupMode] = useState<"solo" | "local">("local");
  const [setupRules, setSetupRules] = useState<Rules>(rules);
  const [setupNames, setSetupNames] = useState([
    "Player 1",
    "Player 2",
    "Player 3",
    "Player 4",
  ]);
  const [setupColours, setSetupColours] = useState([0, 1, 2, 3]);
  const [pace, setPace] = useState<Pace>(loadPace);
  const [commandPending, setCommandPending] = useState(false);
  const [warIntroRequest, setWarIntroRequest] = useState(0);
  const reduced = useReducedMotion();
  const presentation = usePresentation({
    pace,
    reduced,
    paused: screen === "pause" || !!confirm,
    visible: screen === "table" || screen === "pause" || screen === "results",
  });
  const runtimeReady = useRef(false);
  const local = useLocalMatch(
    screen !== "table" || !!confirm,
    pace,
    runtimeReady,
  );
  const lobby = useLobby(onlineEnabled, (g, reset) => {
    if (reset) presentation.manager.reset(g);
    else if (g) presentation.manager.receive(g);
  });
  const { room, playerId, connected, error, setError, send, arrival } = lobby;
  const backTo = useRef<Screen>("menu"),
    settingsBack = useRef<Screen>("menu"),
    pendingRules = useRef<string | undefined>(undefined),
    wasStarted = useRef(false),
    wasRoom = useRef(false),
    lastArrival = useRef(0),
    rulesOpening = useRef("");
  const game = local.game ?? room?.game;
  const presentationReady = presentation.manager.readyFor(game);
  runtimeReady.current =
    presentationReady && !commandPending && screen === "table" && !confirm;
  const unlockAudio = useGameAudio(presentation.view, muted);
  function toggleSound() {
    if (muted) unlockAudio();
    setMuted((v) => !v);
  }
  useEffect(() => {
    try {
      localStorage.setItem("ludi.computerPace", pace);
    } catch {}
  }, [pace]);
  useEffect(() => {
    if (local.game) presentation.manager.receive(local.game);
    else if (!room?.game) presentation.manager.reset();
  }, [local.game, room?.game === undefined]);
  useEffect(() => {
    setCommandPending(false);
  }, [game?.revision, game?.match, error, connected]);
  const finishedBefore = useRef(false);
  const host = !!room && room.hostId === playerId;
  const locked = !!local.game || (!!room && (!host || room.started));
  const activeRules =
    local.game?.rules ??
    room?.rules ??
    (screen === "localsetup" ||
    (screen === "rules" && backTo.current === "localsetup")
      ? setupRules
      : rules);
  const me = room?.players.find((p) => p.id === playerId);
  useEffect(() => {
    try {
      localStorage.setItem("ludi.rules.v1", JSON.stringify(rules));
    } catch {}
  }, [rules]);
  useEffect(() => {
    try {
      localStorage.setItem("ludi.sound", muted ? "off" : "on");
    } catch {}
  }, [muted]);
  useEffect(() => {
    if (arrival !== lastArrival.current) {
      lastArrival.current = arrival;
      setScreen(
        room
          ? room.game?.phase === "finished"
            ? "results"
            : room.started
              ? "table"
              : "lobby"
          : "online",
      );
      setConfirm(null);
    }
    if (room?.started && !wasStarted.current) setScreen("table");
    if (wasStarted.current && room && !room.started) setScreen("lobby");
    if (wasRoom.current && !room) {
      setScreen("online");
      setConfirm(null);
    }
    wasStarted.current = !!room?.started;
    wasRoom.current = !!room;
  }, [arrival, room]);
  useEffect(() => {
    if (game?.phase === "finished" && presentationReady) setScreen("results");
    else if (game && game.phase !== "finished" && finishedBefore.current)
      setScreen("table");
    finishedBefore.current = game?.phase === "finished";
  }, [game?.phase === "finished", game?.match, presentationReady]);
  useEffect(() => {
    if (
      pendingRules.current &&
      room &&
      JSON.stringify(room.rules) === pendingRules.current
    ) {
      pendingRules.current = undefined;
      setPending(false);
      setScreen(backTo.current);
    }
  }, [room]);
  useEffect(() => {
    if (error) {
      pendingRules.current = undefined;
      setPending(false);
    }
  }, [error]);
  useEffect(() => {
    if (!confirm && screen !== "pause") return;
    const dialogs = document.querySelectorAll<HTMLElement>(
      '[role="dialog"], [role="alertdialog"]',
    );
    const dialog = dialogs[dialogs.length - 1];
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]',
        ),
      );
    focusable()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (confirm) setConfirm(null);
        else setScreen("table");
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0],
        last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      if (previous?.isConnected) previous.focus();
    };
  }, [confirm, screen]);
  function go(s: Screen) {
    setError("");
    if (["online", "create", "join", "lobby"].includes(s))
      setOnlineEnabled(true);
    setScreen(s);
  }
  function openRules() {
    backTo.current = screen;
    const r = structuredClone(activeRules);
    rulesOpening.current = JSON.stringify(r);
    setDraft(r);
    go("rules");
  }
  function rulesBack() {
    if (!locked && JSON.stringify(draft) !== rulesOpening.current) {
      setConfirm("discard");
      return;
    }
    go(backTo.current);
  }
  function saveRules() {
    if (validate(draft).length) return;
    if (room) {
      if (!host || room.started) return;
      if (JSON.stringify(draft) === JSON.stringify(room.rules)) {
        go(backTo.current);
        return;
      }
      pendingRules.current = JSON.stringify(draft);
      if (send({ type: "rules", rules: draft })) setPending(true);
      else pendingRules.current = undefined;
    } else {
      if (backTo.current === "localsetup") setSetupRules(draft);
      else setRules(draft);
      go(backTo.current);
    }
  }
  function openLocal(mode: "solo" | "local") {
    setOnlineEnabled(false);
    setSetupMode(mode);
    setSetupRules({
      ...rules,
      players: 2,
      slots:
        mode === "solo"
          ? ["human", "computer", "computer", "computer"]
          : ["human", "human", "human", "human"],
    });
    go("localsetup");
  }
  function openSettings() {
    settingsBack.current = screen;
    go("settings");
  }
  function leave() {
    setConfirm(null);
    if (local.game) {
      local.clear();
      go("menu");
    } else if (room) send({ type: "leave" });
    else go("menu");
  }
  function onBack() {
    if (screen === "rules") rulesBack();
    else if (screen === "settings") go(settingsBack.current);
    else if (screen === "pause") go("table");
    else if (screen === "table") go("pause");
    else if (screen === "lobby") go("menu");
    else if (screen === "create" || screen === "join") go("online");
    else if (screen === "online" || screen === "localsetup") go("play");
    else if (screen === "results") {
      if (room || local.game) setConfirm("leave");
      else go("menu");
    } else go("menu");
  }
  const heading: Record<Screen, string> = {
    menu: "Heritage",
    play: "Play",
    online: "Online",
    create: "Create table",
    join: "Join table",
    lobby: "Your table",
    table: game?.war ? "War" : "Heritage",
    rules: "Match rules",
    settings: "Settings",
    pause: "Table menu",
    localsetup: "Set your table",
    results: "Results",
  };
  const selectedBoard = (
    <Board
      key={boardKey}
      seat={me ? colours.indexOf(me.colour) : undefined}
      safeSquares={activeRules.safeSquares}
      inspector={inspectorOpen && inspectorEnabled}
      onInspect={setInspection}
      onSelect={setFeedback}
      stack={stack}
    />
  );
  const soundControl = (
    <label className="setting-row">
      <span>
        <strong>
          <Icon icon={muted ? VolumeX : Volume2} /> Game sound
        </strong>
        <small>Dice, landing, captures and home.</small>
      </span>
      <input
        type="checkbox"
        role="switch"
        aria-label="Game sound"
        checked={!muted}
        onChange={toggleSound}
      />
    </label>
  );
  const paceControl = (
    <label className="setting-row pace-setting">
      <span>
        <strong>Computer pace</strong>
        <small>How quickly computer turns are presented.</small>
      </span>
      <select
        aria-label="Computer pace"
        value={pace}
        onChange={(e) => setPace(e.target.value as Pace)}
      >
        <option value="quick">Quick</option>
        <option value="normal">Normal</option>
        <option value="relaxed">Relaxed</option>
      </select>
    </label>
  );
  return (
    <div
      className={`game-shell ${screen === "table" || screen === "pause" ? "gameplay-shell" : ""}`}
    >
      <header className="topbar" inert={!!confirm || screen === "pause"}>
        <button
          className="brand"
          aria-label="Main menu"
          onClick={() => {
            if (screen === "rules") rulesBack();
            else go("menu");
          }}
        >
          LUDI<span>✦</span>
        </button>
        <div className="topbar-title">
          <span className="live-mark" />
          <span className="desktop-mode-title">{heading[screen]}</span>
          <span className="mobile-mode-title">
            {game?.war ? "War" : "Heritage"}
          </span>
        </div>
        <div className="topbar-actions">
          {room &&
            screen !== "lobby" &&
            screen !== "rules" &&
            screen !== "results" &&
            screen !== "table" &&
            screen !== "pause" && (
              <button onClick={() => go(room.started ? "table" : "lobby")}>
                Return to table
              </button>
            )}
          {screen !== "menu" && (
            <button className="ghost" onClick={onBack}>
              <Icon icon={screen === "table" ? Menu : ArrowLeft} />{" "}
              {screen === "table" ? "Menu" : "Back"}
            </button>
          )}
          {screen === "menu" && (
            <button
              className="icon-button"
              aria-label="Settings"
              onClick={openSettings}
            >
              <Icon icon={Settings} />
            </button>
          )}
          {inspectorEnabled && (
            <button onClick={() => setInspectorOpen(!inspectorOpen)}>
              Inspector
            </button>
          )}
        </div>
      </header>
      {lobby.savedSession && !onlineEnabled && (
        <div className="session-status"><button className="secondary" onClick={() => { setOnlineEnabled(true); lobby.retry(); }}>Resume Game</button></div>
      )}
      {onlineEnabled && (room || lobby.savedSession) && (
        <div className="session-status" role="status" aria-live="polite">
          <Icon icon={connected ? Wifi : WifiOff} />
          <span>{connected ? lobby.status : `${lobby.status}. Your place is saved. The board may be out of date.`}</span>
          {!connected && <><button onClick={lobby.retry}>Retry</button><button onClick={() => send({type: "leave"})}>Return to Lobby</button></>}
        </div>
      )}
      {error && (
        <div className="error-toast" role="alert">
          <span>
            <Icon icon={TriangleAlert} /> {error}
          </span>
          <button aria-label="Dismiss error" onClick={() => setError("")}>
            <Icon icon={X} />
          </button>
        </div>
      )}
      <main className={`screen screen-${screen}`} inert={!!confirm}>
        {screen === "menu" ? (
          <div className="menu-layout">
            <section className="menu-controls">
              <span className="kicker">YARD STYLE · HERITAGE</span>
              <h1 className="hero-logo">
                LUDI<span>.</span>
              </h1>
              <div className="colour-stripe">
                <i />
                <i />
                <i />
              </div>
              <div className="menu-buttons">
                <button
                  className="primary jumbo"
                  aria-label={room || local.game ? "Return to table" : "Play"}
                  onClick={() =>
                    go(
                      local.game
                        ? local.game.phase === "finished"
                          ? "results"
                          : "table"
                        : room
                          ? room.game?.phase === "finished"
                            ? "results"
                            : room.started
                              ? "table"
                              : "lobby"
                          : "play",
                    )
                  }
                >
                  {room || local.game ? "Return to table" : "Play"}{" "}
                  <Icon icon={ArrowUpRight} />
                </button>
                <button className="secondary" onClick={openRules}>
                  <Icon icon={BookOpen} /> Match rules{" "}
                  <Icon icon={ArrowRight} />
                </button>
                <button className="ghost" onClick={openSettings}>
                  <Icon icon={Settings} /> Settings
                </button>
              </div>
              <div className="menu-preset">
                <span className="kicker">HOUSE RULES</span>
                <strong>{presetNames[activeRules.preset]}</strong>
                <span>2 dice · {activeRules.players} players</span>
              </div>
            </section>
            <section
              className="menu-board"
              aria-label="Heritage board presentation"
            >
              {selectedBoard}
            </section>
          </div>
        ) : screen === "play" ? (
          <section className="choice-screen">
            <div className="screen-title">
              <div>
                <span className="kicker">TAKE YOUR SEAT</span>
                <h1>How you playing?</h1>
              </div>
            </div>
            <div
              className="game-mode-choice"
              role="group"
              aria-label="Game mode"
            >
              {(["heritage", "war"] as const).map((mode) => (
                <button
                  key={mode}
                  aria-pressed={(rules.mode || "heritage") === mode}
                  className={
                    (rules.mode || "heritage") === mode
                      ? "primary"
                      : "secondary"
                  }
                  onClick={() => setRules({ ...rules, mode })}
                >
                  <Icon icon={mode === "war" ? Zap : BookOpen} />{" "}
                  {mode === "war" ? "War" : "Heritage"}{" "}
                  <SelectedIcon
                    selected={(rules.mode || "heritage") === mode}
                  />
                </button>
              ))}
              <p>
                {rules.mode === "war"
                  ? "Power banks, tactical skills and a changing battlefield."
                  : "The classic table. Your house rules."}
              </p>
            </div>
            <div className="mode-grid">
              <article className="mode-card">
                <span className="mode-number">01</span>
                <h2>Solo</h2>
                <p>You and the computer.</p>
                <span className="pill">1 human · 1–3 computers</span>
                <button className="secondary" onClick={() => openLocal("solo")}>
                  <Icon icon={UserRound} /> Play solo <Icon icon={ArrowRight} />
                </button>
              </article>
              <article className="mode-card">
                <span className="mode-number">02</span>
                <h2>Local</h2>
                <p>Pass the dice. Share a screen.</p>
                <span className="pill">2–4 players · offline</span>
                <button
                  className="secondary"
                  onClick={() => openLocal("local")}
                >
                  <Icon icon={Users} /> Play local <Icon icon={ArrowRight} />
                </button>
              </article>
              <article className="mode-card online-card">
                <span className="mode-number">03</span>
                <h2>Online</h2>
                <p>Gather your people at a private table.</p>
                <span className="pill">Private matches</span>
                <button
                  className="primary"
                  onClick={() =>
                    go(room ? (room.started ? "table" : "lobby") : "online")
                  }
                >
                  <Icon icon={Wifi} />{" "}
                  {room ? "Return to table" : "Find your table"}{" "}
                  <Icon icon={ArrowRight} />
                </button>
              </article>
            </div>
          </section>
        ) : screen === "online" ? (
          <section className="choice-screen online-screen">
            <div className="screen-title">
              <div>
                <span className="kicker">BRING YOUR PEOPLE</span>
                <h1>Private tables</h1>
                <p>Create a table or join with an invitation code.</p>
              </div>
            </div>
            <div className="online-choices">
              <button
                className="create-choice"
                onClick={() =>
                  go(room ? (room.started ? "table" : "lobby") : "create")
                }
              >
                <span className="mode-number">
                  <Icon icon={Plus} size={26} />
                </span>
                <h2>{room ? "Your table" : "Create table"}</h2>
                <p>Choose the rules. Save a seat.</p>
                <span className="arrow">
                  <Icon icon={ArrowUpRight} />
                </span>
              </button>
              <button
                className="join-choice"
                onClick={() =>
                  go(room ? (room.started ? "table" : "lobby") : "join")
                }
              >
                <span className="mode-number">
                  <Icon icon={LogIn} size={26} />
                </span>
                <h2>Join table</h2>
                <p>Your people have the code.</p>
                <span className="arrow">
                  <Icon icon={ArrowUpRight} />
                </span>
              </button>
            </div>
            {lobby.savedSession && <button className="secondary" onClick={() => { setOnlineEnabled(true); lobby.retry(); }}>Resume Game</button>}
            <p className="connection-note">
              <Icon icon={lobby.ready ? Wifi : WifiOff} />{" "}
              {lobby.ready
                ? "Ready to connect your table."
                : "Connecting to tables…"}
            </p>
          </section>
        ) : screen === "create" || screen === "join" ? (
          <section className="entry-screen">
            <div className="entry-art">
              <span className="kicker">
                LUDI / {rules.mode === "war" ? "WAR" : "HERITAGE"}
              </span>
              <div className="entry-glyph">
                <Icon icon={screen === "create" ? Plus : LogIn} size={40} />
              </div>
              <h2>
                {screen === "create" ? "Set the table." : "You’re invited."}
              </h2>
              <div className="colour-stripe">
                <i />
                <i />
                <i />
              </div>
            </div>
            <div className="entry-panel">
              <h1>{heading[screen]}</h1>
              <p>
                {screen === "create"
                  ? "A private table for your circle."
                  : "Enter your name and six-character room code."}
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (room) return;
                  if (screen === "create")
                    send({ type: "create", name, rules });
                  else
                    send({
                      type: "join",
                      name,
                      code: code.trim().toUpperCase(),
                    });
                }}
              >
                <label>
                  Your name
                  <input
                    required
                    maxLength={30}
                    autoComplete="nickname"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name at the table"
                  />
                </label>
                {screen === "join" ? (
                  <label>
                    Room code
                    <input
                      required
                      maxLength={6}
                      pattern="[A-Fa-f0-9]{6}"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="A1B2C3"
                      autoCapitalize="characters"
                    />
                  </label>
                ) : (
                  <div className="chosen-rules">
                    <span className="kicker">YOUR HOUSE RULES</span>
                    <strong>{presetNames[rules.preset]}</strong>
                    <p>
                      {rules.players} players ·{" "}
                      {rules.timer ? `${rules.timer}s turns` : "No timer"} ·{" "}
                      {rules.visibility}
                    </p>
                    <button
                      type="button"
                      className="text-button"
                      onClick={openRules}
                    >
                      <Icon icon={BookOpen} /> Change rules{" "}
                      <Icon icon={ArrowRight} />
                    </button>
                  </div>
                )}
                <button
                  className="primary"
                  disabled={
                    !lobby.ready ||
                    !!room ||
                    (screen === "create" && validate(rules).length > 0)
                  }
                >
                  {screen === "create" ? "Create private table" : "Join table"}{" "}
                  <Icon icon={ArrowRight} />
                </button>
              </form>
              {!lobby.ready && (
                <p className="connection-note" role="status">
                  <Icon icon={WifiOff} /> Connecting to tables…
                </p>
              )}
              {screen === "create" && rules.visibility === "public" && (
                <p className="subtle">
                  Public discovery is unavailable. People can join with your
                  code.
                </p>
              )}
            </div>
          </section>
        ) : screen === "localsetup" ? (
          <LocalSetup
            mode={setupMode}
            rules={setupRules}
            onRules={setSetupRules}
            names={setupNames}
            setNames={setSetupNames}
            assigned={setupColours}
            assign={setSetupColours}
            onChangeRules={openRules}
            onStart={(seats) => {
              presentation.manager.reset(local.start(setupRules, seats));
              go("table");
            }}
          />
        ) : screen === "rules" ? (
          <RulesStudio
            rules={locked ? activeRules : draft}
            onChange={setDraft}
            locked={locked}
            pending={pending}
            solo={backTo.current === "localsetup" && setupMode === "solo"}
            onApply={saveRules}
            onBack={() => go(backTo.current)}
          />
        ) : screen === "lobby" && room ? (
          <section className="lobby-screen">
            <div className="screen-title">
              <div>
                <span className="kicker">
                  {room.rules.visibility.toUpperCase()} TABLE
                </span>
                <h1>Your people. Your table.</h1>
              </div>
              <div className="room-invitation">
                <span>ROOM CODE</span>
                <strong>{room.code}</strong>
                <button
                  aria-label="Copy room code"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(room.code);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } catch {
                      setError(`Your invitation code is ${room.code}`);
                    }
                  }}
                >
                  <Icon icon={copied ? Check : Copy} />{" "}
                  {copied ? "Copied" : "Copy code"}
                </button>
              </div>
            </div>
            <div className="lobby-layout">
              <div className="lobby-players">
                <div className="seats">
                  {Array.from({ length: room.rules.players }, (_, i) => {
                    const p = room.players.find((p) => p.colour === colours[i]);
                    return (
                      <article
                        className={`seat ${p?.id === playerId ? "your-seat" : ""}`}
                        key={i}
                      >
                        <span className={`seat-token ${colours[i]}`}>
                          {i + 1}
                        </span>
                        <div>
                          <h2>
                            {p?.name || "Open seat"}
                            {p?.id === playerId && <small> · You</small>}
                          </h2>
                          <p>
                            <Icon
                              icon={p?.computer ? Bot : UserRound}
                              size={14}
                            />{" "}
                            {p
                              ? p.computer
                                ? "Computer seat"
                                : p.id === room.hostId
                                  ? "Host"
                                  : "Guest"
                              : "Share the invitation code"}
                          </p>
                        </div>
                        <span
                          className={`ready-state ${p?.ready ? "is-ready" : ""}`}
                        >
                          <Icon
                            icon={
                              p?.ready
                                ? CircleCheck
                                : p && !p.connected
                                  ? WifiOff
                                  : Clock
                            }
                            size={14}
                          />{" "}
                          {p
                            ? p.connected
                              ? p.ready
                                ? "Ready"
                                : "Not ready"
                              : "Rejoining…"
                            : "Waiting"}
                        </span>
                      </article>
                    );
                  })}
                </div>
                <p className="subtle">
                  {room.players.some((p) => !p.connected)
                    ? "A seat is reserved while its player reconnects."
                    : room.started
                      ? "The table is locked."
                      : host
                        ? "Set the rules, then have everyone ready up."
                        : "The host sets the rules. Ready up when you’re happy."}
                </p>
                <div className="lobby-bottom">
                  {room.started ? (
                    <button className="primary" onClick={() => go("table")}>
                      Return to game table <Icon icon={ArrowRight} />
                    </button>
                  ) : (
                    <>
                      <button
                        className={me?.ready ? "secondary" : "primary"}
                        disabled={!connected}
                        onClick={() =>
                          send({ type: "ready", ready: !me?.ready })
                        }
                      >
                        <Icon icon={me?.ready ? CircleCheck : Check} />{" "}
                        {me?.ready ? "Ready · change" : "Ready up"}
                      </button>
                      {host && (
                        <button
                          className="primary start-button"
                          disabled={
                            !connected ||
                            room.players.length !== room.rules.players ||
                            room.players.some((p) => !p.ready || !p.connected)
                          }
                          onClick={() => send({ type: "start" })}
                        >
                          <Icon icon={Play} /> Start session{" "}
                          <Icon icon={ArrowRight} />
                        </button>
                      )}
                    </>
                  )}
                  <button className="ghost" onClick={() => setConfirm("leave")}>
                    <Icon icon={LogOut} /> Leave table
                  </button>
                </div>
              </div>
              <aside className="house-panel">
                <span className="kicker">AGREED AT THIS TABLE</span>
                <h2>{presetNames[room.rules.preset]}</h2>
                <ul>
                  <li>
                    {room.rules.sixRequired ? "Six to enter" : "Open entry"}
                  </li>
                  <li>{room.rules.blockSize}-counter blocks</li>
                  <li>
                    {room.rules.exactFinish ? "Exact finish" : "Open finish"}
                  </li>
                  <li>
                    {room.rules.timer
                      ? `${room.rules.timer}-second turns`
                      : "No turn timer"}
                  </li>
                </ul>
                <button className="secondary" onClick={openRules}>
                  {host && !room.started
                    ? "Edit match rules"
                    : "View match rules"}{" "}
                  <Icon icon={ArrowRight} />
                </button>
                <p className="subtle">
                  {room.started
                    ? "Rules locked"
                    : host
                      ? "Saving changes resets everyone’s ready state."
                      : "Only the host can change these rules."}
                </p>
                <p className="availability">
                  Ready up to start{" "}
                  {room.rules.mode === "war" ? "a War" : "a Heritage"} match.
                </p>
              </aside>
            </div>
          </section>
        ) : (screen === "table" || screen === "pause") && game ? (
          <>
            <GameTable
              game={game}
              gameError={error}
              introRequest={warIntroRequest}
              presentation={presentation.view}
              presentationReady={presentationReady && !commandPending}
              playerId={playerId}
              online={!local.game}
              connected={connected}
              deadline={local.game ? local.deadline : room?.deadline}
              muted={muted}
              onMute={toggleSound}
              paused={screen === "pause" || !!confirm}
              onRoll={() => {
                if (!runtimeReady.current) return;
                if (local.game) local.roll();
                else {
                  setCommandPending(true);
                  if (
                    !send({
                      type: "roll",
                      revision: game.revision,
                      match: game.match,
                    })
                  )
                    setCommandPending(false);
                }
              }}
              onSkill={(id) => {
                if (!runtimeReady.current) return;
                if (local.game) local.skill(id);
                else {
                  setCommandPending(true);
                  if (
                    !send({
                      type: "skill",
                      actionId: id,
                      revision: game.revision,
                      match: game.match,
                    })
                  )
                    setCommandPending(false);
                }
              }}
              onMove={(id) => {
                if (!runtimeReady.current) return;
                if (local.game) local.move(id);
                else {
                  setCommandPending(true);
                  if (
                    !send({
                      type: "move",
                      moveId: id,
                      revision: game.revision,
                      match: game.match,
                    })
                  )
                    setCommandPending(false);
                }
              }}
              onPass={() => {
                if (!runtimeReady.current) return;
                if (local.game) local.pass();
                else {
                  setCommandPending(true);
                  if (
                    !send({
                      type: "pass",
                      revision: game.revision,
                      match: game.match,
                    })
                  )
                    setCommandPending(false);
                }
              }}
              onPause={() => go("pause")}
              onRules={openRules}
            />
            {screen === "pause" && (
              <div className="modal-backdrop">
                <section
                  className="pause-panel"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Table menu"
                >
                  <span className="kicker">TAKE A BREATHER</span>
                  <h1>Table menu</h1>
                  <button
                    autoFocus
                    className="primary"
                    onClick={() => go("table")}
                  >
                    <Icon icon={Play} /> Resume <Icon icon={ArrowRight} />
                  </button>
                  {soundControl}
                  {paceControl}
                  {game.war && (
                    <button
                      className="secondary"
                      onClick={() => {
                        setWarIntroRequest((n) => n + 1);
                        go("table");
                      }}
                    >
                      <Icon icon={RotateCcw} /> Replay War introduction
                    </button>
                  )}
                  <button className="secondary" onClick={openRules}>
                    <Icon icon={BookOpen} /> View match rules
                  </button>
                  {!local.game && (
                    <p className="subtle">
                      The online match continues while this menu is open.
                    </p>
                  )}
                  <button
                    className="ghost danger"
                    onClick={() => setConfirm("leave")}
                  >
                    <Icon icon={LogOut} /> Leave table
                  </button>
                </section>
              </div>
            )}
          </>
        ) : screen === "results" && game?.phase === "finished" ? (
          <Results
            game={game}
            online={!local.game}
            voted={!!room?.rematchReady?.includes(playerId)}
            votes={room?.rematchReady?.length ?? 0}
            host={host}
            onRematch={() => {
              if (local.game) {
                local.rematch();
                go("table");
              } else send({ type: "rematch" });
            }}
            onLobby={() => send({ type: "lobby" })}
            onMenu={() => {
              if (local.game) {
                local.clear();
                go("menu");
              } else setConfirm("leave");
            }}
          />
        ) : screen === "settings" ? (
          <section className="settings-screen">
            <span className="kicker">MAKE YOURSELF AT HOME</span>
            <h1>Settings</h1>
            {soundControl}
            {paceControl}
            <p className="subtle">
              Motion follows your device’s reduced-motion preference.
            </p>
            <button
              className="primary"
              onClick={() => go(settingsBack.current)}
            >
              <Icon icon={Check} /> Done <Icon icon={ArrowRight} />
            </button>
          </section>
        ) : (
          <section className="empty-state">
            <h1>Your table has closed.</h1>
            <button className="primary" onClick={() => go("online")}>
              <Icon icon={Wifi} /> Find a table <Icon icon={ArrowRight} />
            </button>
          </section>
        )}
      </main>
      {confirm && (
        <div className="modal-backdrop">
          <section
            className="confirm-panel"
            role="alertdialog"
            aria-modal="true"
            aria-label={
              confirm === "leave"
                ? "Leave this table?"
                : "Discard rule changes?"
            }
          >
            <h2>
              <Icon icon={TriangleAlert} />{" "}
              {confirm === "leave"
                ? "Leave this table?"
                : "Discard rule changes?"}
            </h2>
            <p>
              {confirm === "leave"
                ? "Your seat will be released for someone else."
                : "Your saved rules will stay as they are."}
            </p>
            <div className="button-row">
              <button
                className="secondary"
                autoFocus
                onClick={() => setConfirm(null)}
              >
                <Icon icon={X} />{" "}
                {confirm === "leave" ? "Stay at table" : "Keep editing"}
              </button>
              <button
                className="primary"
                onClick={() => {
                  if (confirm === "leave") leave();
                  else {
                    setConfirm(null);
                    go(backTo.current);
                  }
                }}
              >
                <Icon icon={confirm === "leave" ? LogOut : RotateCcw} />{" "}
                {confirm === "leave" ? "Leave table" : "Discard changes"}
              </button>
            </div>
          </section>
        </div>
      )}
      {inspectorOpen && Inspector && (
        <Suspense fallback={null}>
          <Inspector
            rules={activeRules}
            inspection={inspection}
            stack={stack}
            onStack={() => setStack(!stack)}
            onReset={() => {
              setStack(false);
              setBoardKey((k) => k + 1);
              setInspection("Board reset");
            }}
            onClose={() => setInspectorOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
