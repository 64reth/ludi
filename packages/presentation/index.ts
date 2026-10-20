import { cellId, currentPlayer, type Game } from "../game-engine/index";
import { pointFor, tokensFor, type Point, type Token } from "../board/layout";
export type Pace = "quick" | "normal" | "relaxed";
export const paces: Record<
  Pace,
  {
    think: number;
    dice: number;
    result: number;
    select: number;
    square: number;
    cap: number;
    land: number;
    resolve: number;
    turn: number;
  }
> = {
  quick: {
    think: 220,
    dice: 300,
    result: 120,
    select: 90,
    square: 65,
    cap: 750,
    land: 90,
    resolve: 220,
    turn: 230,
  },
  normal: {
    think: 800,
    dice: 650,
    result: 220,
    select: 180,
    square: 150,
    cap: 1400,
    land: 160,
    resolve: 600,
    turn: 450,
  },
  relaxed: {
    think: 1200,
    dice: 850,
    result: 350,
    select: 260,
    square: 210,
    cap: 1900,
    land: 200,
    resolve: 850,
    turn: 700,
  },
};
const human = {
  think: 0,
  dice: 420,
  result: 100,
  select: 80,
  square: 75,
  cap: 750,
  land: 100,
  resolve: 240,
  turn: 300,
};
export type Journey = {
  token: Token;
  destination: Token;
  points: Point[];
  distance: number;
};
export type Transition = {
  id: string;
  from: Game;
  to: Game;
  kind: "roll" | "move" | "notice";
  actor: Game["players"][number];
  journeys: Journey[];
  captured: Token[];
  formedBlock: boolean;
  home: boolean;
  finished: boolean;
  noMoves: boolean;
  penalty: boolean;
  turnChanged: boolean;
  message: string;
};
export type Stage =
  | "idle"
  | "dice"
  | "dice-result"
  | "select"
  | "travel"
  | "land"
  | "resolve"
  | "turn";
export type View = {
  game?: Game;
  active?: Transition;
  stage: Stage;
  duration: number;
  busy: boolean;
  message: string;
  announcement: string;
  serial: number;
  reduced: boolean;
};
const colourNames = ["RED", "GREEN", "GOLD", "BLUE"];
export function turnAnnouncement(g: Game) {
  if (g.phase === "finished")
    return `${g.players.find((p) => p.id === g.winnerId)?.name || "The winner"} wins.`;
  const p = currentPlayer(g);
  return `${colourNames[p.colour]}'S TURN · ${p.name} · ${p.computer ? "Computer" : "Human"}`;
}
export function sameGame(a: Game | undefined, b: Game | undefined) {
  return (
    !!a &&
    !!b &&
    a.match === b.match &&
    a.revision === b.revision &&
    a.players.length === b.players.length &&
    a.players.every((p, i) => p.id === b.players[i].id)
  );
}
export function routeFor(
  colour: number,
  piece: number,
  from: number,
  to: number,
  start: Point,
  end: Point,
): Point[] {
  if (from < 0) return [start, end];
  const points = [start];
  for (let progress = from + 1; progress < to; progress++)
    points.push(pointFor(cellId(colour, progress, piece)));
  points.push(end);
  return points;
}
export function describeTransition(from: Game, to: Game): Transition {
  const actor = currentPlayer(from),
    before = tokensFor(from),
    after = tokensFor(to);
  const journeys: Journey[] = [];
  const captured: Token[] = [];
  for (const old of before) {
    const next = after.find((p) => p.key === old.key);
    if (!next) continue;
    if (old.owner === actor.id && next.progress > old.progress)
      journeys.push({
        token: old,
        destination: next,
        points: routeFor(
          old.colour,
          old.piece,
          old.progress,
          next.progress,
          old,
          next,
        ),
        distance: old.progress < 0 ? 1 : next.progress - old.progress,
      });
    else if (old.progress >= 0 && next.progress === -1) captured.push(old);
  }
  if (
    to.war?.lastSkill?.revision === to.revision &&
    to.war.lastSkill.skill === "switch"
  )
    journeys.length = 0;
  if (journeys.length > 1)
    for (const j of journeys) {
      const center = pointFor(j.token.cell),
        dx = j.token.x - center.x,
        dy = j.token.y - center.y;
      j.points = j.points.map((p, i) =>
        i > 0 && i < j.points.length - 1 ? { x: p.x + dx, y: p.y + dy } : p,
      );
    }
  const kind =
    to.rollNumber > from.rollNumber
      ? "roll"
      : journeys.length
        ? "move"
        : "notice";
  const a = to.players.find((p) => p.id === actor.id)!;
  const formedBlock = a.blocks > actor.blocks,
    home = journeys.some(
      (j) => j.token.progress <= 50 && j.destination.progress > 50,
    ),
    finished = journeys.some((j) => j.destination.progress === 56);
  const noMoves = kind === "roll" && to.phase !== "move";
  const penalty =
    kind === "roll" &&
    from.rules.sixPenalty !== "none" &&
    from.sixStreak === 2 &&
    !!to.dice?.includes(6);
  let message = "";
  if (kind === "roll") {
    message = `${actor.name} rolled ${to.dice!.join(" and ")}.`;
    if (penalty)
      message += " Three consecutive throws with a six: turn forfeited.";
    else if (noMoves) message += " No legal moves with these dice.";
    if (noMoves && to.current === from.current && !penalty)
      message += " Bonus roll.";
  } else if (kind === "move") {
    const pieces = journeys.map((j) => j.token.piece + 1).join(" + ");
    message =
      journeys[0].token.progress < 0
        ? `${actor.name} released counter ${pieces}.`
        : `${actor.name} moved ${journeys.length > 1 ? "block" : "counter"} ${pieces} ${journeys[0].distance} ${journeys[0].distance === 1 ? "space" : "spaces"}.`;
    if (captured.length)
      message += ` ${captured.map((p) => `${from.players.find((r) => r.id === p.owner)!.name}'s counter ${p.piece + 1}`).join(" and ")} captured; returned to yard.`;
    if (formedBlock) message += " Block formed.";
    if (home) message += " Home lane entered.";
    if (finished) message += " Home!";
  } else
    message =
      to.events.filter((e) => e.kind !== "turn").at(-1)?.text ||
      to.events.at(-1)?.text ||
      "";
  if (
    to.war &&
    to.war.feedback !== from.war?.feedback &&
    !message.includes(to.war.feedback)
  )
    message += ` ${to.war.feedback}`;
  return {
    id: `${to.match}:${to.revision}`,
    from,
    to,
    actor,
    kind,
    journeys,
    captured,
    formedBlock,
    home,
    finished,
    noMoves,
    penalty,
    turnChanged: to.turn !== from.turn || to.current !== from.current,
    message,
  };
}
type Step = { stage: Stage; duration: number };
export function stepsFor(
  t: Transition,
  pace: Pace,
  reduced: boolean,
  factor = 1,
): Step[] {
  const p = t.actor.computer ? paces[pace] : human;
  const ms = (n: number) => Math.max(40, Math.round(n * factor));
  const steps: Step[] = [];
  if (t.kind === "roll")
    steps.push(
      { stage: "dice", duration: ms(reduced ? 150 : p.dice) },
      { stage: "dice-result", duration: ms(reduced ? 180 : p.result) },
    );
  else if (t.kind === "move") {
    steps.push({ stage: "select", duration: ms(reduced ? 60 : p.select) });
    if (!reduced)
      steps.push({
        stage: "travel",
        duration: ms(
          Math.max(
            t.journeys[0].token.progress < 0
              ? p.square * 3
              : Math.min(p.square * 2, 220),
            Math.min(
              p.cap,
              p.square * Math.max(...t.journeys.map((j) => j.distance)),
            ),
          ),
        ),
      });
    steps.push(
      { stage: "land", duration: ms(reduced ? 80 : p.land) },
      { stage: "resolve", duration: ms(reduced ? 180 : p.resolve) },
    );
  } else steps.push({ stage: "resolve", duration: ms(reduced ? 120 : 240) });
  if (t.turnChanged && t.to.phase !== "finished")
    steps.push({ stage: "turn", duration: ms(reduced ? 250 : p.turn) });
  return steps;
}
export type PresentationOptions = {
  pace: Pace;
  reduced: boolean;
  paused: boolean;
  visible: boolean;
};
export type Clock = {
  now: () => number;
  set: (fn: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
};
const realClock: Clock = {
  now: () => Date.now(),
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};
// A bounded display queue. Confirmed game snapshots are read-only; no callback commits gameplay.
export class PresentationQueue {
  private latest?: Game;
  private pending: Transition[] = [];
  private steps: Step[] = [];
  private step = 0;
  private timer: unknown;
  private began = 0;
  private left = 0;
  private generation = 0;
  private listeners = new Set<() => void>();
  private options: PresentationOptions;
  private view: View;
  constructor(
    options: PresentationOptions,
    private clock: Clock = realClock,
  ) {
    this.options = options;
    this.view = {
      stage: "idle",
      duration: 0,
      busy: false,
      message: "",
      announcement: "",
      serial: 0,
      reduced: options.reduced,
    };
  }
  snapshot = () => this.view;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private emit(next: View) {
    this.view = next;
    for (const fn of this.listeners) fn();
  }
  private cancel() {
    if (this.timer !== undefined) this.clock.clear(this.timer);
    this.timer = undefined;
    this.generation++;
  }
  reset = (game?: Game) => {
    this.cancel();
    this.latest = game;
    this.pending = [];
    this.steps = [];
    this.step = 0;
    this.emit({
      game,
      stage: "idle",
      duration: 0,
      busy: false,
      message: game?.events.at(-1)?.text || "",
      announcement: game ? turnAnnouncement(game) : "",
      serial: this.view.serial + 1,
      reduced: this.options.reduced,
    });
  };
  receive = (game: Game) => {
    const previous = this.latest;
    if (
      !previous ||
      game.match !== previous.match ||
      game.players.map((p) => p.id).join("|") !==
        previous.players.map((p) => p.id).join("|")
    ) {
      this.reset(game);
      return;
    }
    if (game.revision <= previous.revision) return;
    if (!this.options.visible || game.revision !== previous.revision + 1) {
      this.reset(game);
      return;
    }
    this.latest = game;
    this.pending.push(describeTransition(previous, game));
    if (this.pending.length > 8) {
      this.reset(game);
      return;
    }
    if (!this.view.active) this.next();
  };
  readyFor = (game: Game | undefined) =>
    !this.view.busy && sameGame(this.view.game, game);
  configure = (options: PresentationOptions) => {
    const old = this.options;
    this.options = options;
    if (!options.visible || old.reduced !== options.reduced) {
      if (this.latest) this.reset(this.latest);
      return;
    }
    if (options.paused && !old.paused) {
      this.left = Math.max(0, this.left - (this.clock.now() - this.began));
      this.cancel();
    } else if (!options.paused && old.paused && this.view.active) this.arm();
  };
  private next() {
    const active = this.pending.shift();
    if (!active) {
      this.emit({
        ...this.view,
        game: this.latest,
        active: undefined,
        stage: "idle",
        duration: 0,
        busy: false,
        serial: this.view.serial + 1,
      });
      return;
    }
    // Catch up faster when the server has already progressed. Never enable stale controls.
    const factor =
      this.pending.length >= 4 ? 0.22 : this.pending.length >= 2 ? 0.45 : 1;
    this.steps = stepsFor(
      active,
      this.options.pace,
      this.options.reduced,
      factor,
    );
    this.step = 0;
    this.enter(active);
  }
  private enter(active: Transition) {
    const { stage, duration } = this.steps[this.step];
    const game = ["resolve", "turn"].includes(stage) ? active.to : active.from;
    let announcement = "";
    if (stage === "dice")
      announcement = `${active.actor.name} rolls both dice.`;
    else if (stage === "dice-result") announcement = active.message;
    else if (stage === "select")
      announcement = `${active.actor.name} selected ${active.journeys.length > 1 ? "block" : "counter"} ${active.journeys.map((j) => j.token.piece + 1).join(" + ")}.`;
    else if (stage === "travel")
      announcement = `Moving ${active.journeys[0].distance} spaces along the track.`;
    else if (stage === "land")
      announcement = `${active.actor.name}'s ${active.journeys.length > 1 ? "block" : "counter"} landed.`;
    else if (stage === "resolve") announcement = active.message;
    else if (stage === "turn") announcement = turnAnnouncement(active.to);
    this.left = duration;
    this.emit({
      game,
      active,
      stage,
      duration,
      busy: true,
      message: active.message,
      announcement,
      serial: this.view.serial + 1,
      reduced: this.options.reduced,
    });
    if (!this.options.paused) this.arm();
  }
  private arm() {
    this.began = this.clock.now();
    const generation = this.generation;
    this.timer = this.clock.set(() => {
      if (generation !== this.generation) return;
      this.timer = undefined;
      this.step++;
      if (this.step >= this.steps.length) this.next();
      else this.enter(this.view.active!);
    }, this.left);
  }
  dispose() {
    this.cancel();
    this.listeners.clear();
  }
}
