import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  rollGame,
  moveGame,
  legalMoves,
  chooseMove,
  type Game,
} from "../packages/game-engine/index";
import { preset } from "../packages/rules/index";
import {
  PresentationQueue,
  describeTransition,
  stepsFor,
  paces,
  routeFor,
  type Clock,
  type PresentationOptions,
} from "../packages/presentation/index";
import { pointFor } from "../packages/board/layout";
const options: PresentationOptions = {
  pace: "normal",
  reduced: false,
  paused: false,
  visible: true,
};
class FakeClock implements Clock {
  time = 0;
  serial = 0;
  tasks = new Map<number, { at: number; fn: () => void }>();
  now = () => this.time;
  set = (fn: () => void, ms: number) => {
    const id = ++this.serial;
    this.tasks.set(id, { at: this.time + ms, fn });
    return id;
  };
  clear = (id: unknown) => {
    this.tasks.delete(id as number);
  };
  advance(ms: number) {
    const end = this.time + ms;
    for (;;) {
      const next = [...this.tasks.entries()]
        .filter(([, t]) => t.at <= end)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      this.time = next[1].at;
      this.tasks.delete(next[0]);
      next[1].fn();
    }
    this.time = end;
  }
  flush() {
    this.advance(100000);
  }
}
function initial(computer = false) {
  return createGame(
    {
      ...preset("don"),
      players: 2,
      slots: ["human", computer ? "computer" : "human", "human", "human"],
    },
    [
      { id: "a", name: "Ada", colour: 0, computer: false },
      { id: "b", name: "Ben", colour: 1, computer },
    ],
  );
}
function moving(
  g: Game,
  a: number[],
  b: number[],
  dice: [number, number],
): Game {
  return {
    ...g,
    phase: "move",
    dice,
    remaining: [0, 1],
    players: g.players.map((p, i) => ({ ...p, pieces: i === 0 ? a : b })),
  };
}
test("routes follow every track corner, home transition and exact finish", () => {
  const points = routeFor(
    0,
    0,
    8,
    15,
    pointFor("track-50"),
    pointFor("track-5"),
  );
  assert.equal(points.length, 8);
  assert.deepEqual(
    points.slice(1, -1),
    [51, 0, 1, 2, 3, 4].map((i) => pointFor(`track-${i}`)),
  );
  const home = routeFor(
    0,
    1,
    49,
    56,
    pointFor("track-39"),
    pointFor("finish-0"),
  );
  assert.deepEqual(home.slice(1, -1), [
    pointFor("track-40"),
    ...Array.from({ length: 5 }, (_, i) => pointFor(`home-0-${i}`)),
  ]);
});
test("move selection, travel, landing and capture resolve in order without changing state", () => {
  const from = moving(initial(), [5, -1, -1, -1], [47, -1, -1, -1], [3, 1]);
  const next = moveGame(
    from,
    "a",
    legalMoves(from).find((m) => m.to === 8)!.id,
  );
  const copy = structuredClone(next);
  const clock = new FakeClock(),
    queue = new PresentationQueue(options, clock);
  queue.reset(from);
  queue.receive(next);
  assert.equal(queue.snapshot().stage, "select");
  assert.equal(queue.snapshot().game, from);
  assert.equal(queue.readyFor(next), false);
  clock.advance(80);
  assert.equal(queue.snapshot().stage, "travel");
  assert.equal(queue.snapshot().active!.journeys[0].points.length, 4);
  assert.equal(queue.snapshot().game!.players[1].pieces[0], 47);
  clock.advance(225);
  assert.equal(queue.snapshot().stage, "land");
  assert.equal(queue.snapshot().game!.players[1].pieces[0], 47);
  clock.advance(100);
  assert.equal(queue.snapshot().stage, "resolve");
  assert.equal(queue.snapshot().game!.players[1].pieces[0], -1);
  assert.match(queue.snapshot().message, /captured; returned to yard/);
  clock.flush();
  assert.equal(queue.readyFor(next), true);
  assert.deepEqual(next, copy);
});
test("incoming roll and move snapshots remain ordered, with no early input or overlapping travel", () => {
  const from = initial();
  const rolled = rollGame(from, "a", [6, 3]);
  const released = moveGame(rolled, "a", legalMoves(rolled)[0].id);
  const moved = moveGame(released, "a", chooseMove(released)!.id);
  const clock = new FakeClock(),
    queue = new PresentationQueue(options, clock),
    seen: string[] = [];
  queue.subscribe(() => {
    const v = queue.snapshot();
    if (v.active) seen.push(`${v.active.id}/${v.stage}`);
  });
  queue.reset(from);
  queue.receive(rolled);
  queue.receive(released);
  queue.receive(moved);
  assert.equal(queue.snapshot().stage, "dice");
  clock.advance(419);
  assert.equal(queue.snapshot().stage, "dice");
  assert.equal(queue.readyFor(moved), false);
  clock.flush();
  assert.equal(queue.readyFor(moved), true);
  const ids = seen
    .map((s) => s.split("/")[0])
    .filter((v, i, a) => i === 0 || v !== a[i - 1]);
  assert.deepEqual(ids, ["1:1", "1:2", "1:3"]);
  assert.ok(seen.indexOf("1:1/dice-result") < seen.indexOf("1:2/select"));
  assert.equal(seen.filter((s) => s === "1:2/travel").length, 1);
});
test("pause preserves the remaining phase; reconnect resets to latest and cancels stale callbacks", () => {
  const from = initial(),
    next = rollGame(from, "a", [6, 3]);
  const clock = new FakeClock(),
    queue = new PresentationQueue(options, clock);
  queue.reset(from);
  queue.receive(next);
  clock.advance(100);
  queue.configure({ ...options, paused: true });
  clock.advance(9000);
  assert.equal(queue.snapshot().stage, "dice");
  queue.configure(options);
  clock.advance(319);
  assert.equal(queue.snapshot().stage, "dice");
  clock.advance(1);
  assert.equal(queue.snapshot().stage, "dice-result");
  const latest = moveGame(next, "a", legalMoves(next)[0].id);
  queue.reset(latest);
  clock.flush();
  assert.equal(queue.snapshot().stage, "idle");
  assert.equal(queue.snapshot().game, latest);
  assert.equal(queue.snapshot().active, undefined);
  assert.equal(clock.tasks.size, 0);
});
test("reduced motion preserves dice, landing, capture and turn information without travel", () => {
  const from = moving(initial(), [5, -1, -1, -1], [47, -1, -1, -1], [3, 1]);
  const to = moveGame(from, "a", legalMoves(from).find((m) => m.to === 8)!.id);
  const transition = describeTransition(from, to);
  const plan = stepsFor(transition, "normal", true);
  assert.ok(!plan.some((s) => s.stage === "travel"));
  assert.ok(plan.some((s) => s.stage === "land"));
  assert.ok(plan.some((s) => s.stage === "resolve"));
  assert.match(transition.message, /captured/);
  const noMove = describeTransition(
    initial(),
    rollGame(initial(), "a", [1, 2]),
  );
  assert.equal(noMove.noMoves, true);
  assert.match(noMove.message, /No legal moves/);
  assert.equal(noMove.turnChanged, true);
});
test("computer pace affects only durations; routes, dice and target state are invariant", () => {
  const g = initial(true);
  g.current = 1;
  const a = rollGame(g, "b", [6, 6]);
  const b = moveGame(a, "b", legalMoves(a)[0].id);
  const transition = describeTransition(a, b);
  const quick = stepsFor(transition, "quick", false),
    normal = stepsFor(transition, "normal", false),
    relaxed = stepsFor(transition, "relaxed", false);
  const sum = (v: typeof quick) => v.reduce((n, s) => n + s.duration, 0);
  assert.ok(sum(quick) < sum(normal) && sum(normal) < sum(relaxed));
  assert.equal(paces.normal.think, 800);
  assert.equal(transition.to, b);
  assert.equal(transition.journeys[0].destination.progress, 0);
  const home = moving(initial(), [54, 56, 56, 56], [-1, -1, -1, -1], [1, 1]);
  const won = moveGame(home, "a", legalMoves(home)[0].id);
  const last = moveGame(won, "a", legalMoves(won)[0].id);
  assert.equal(last.phase, "finished");
  const clock = new FakeClock(),
    queue = new PresentationQueue(options, clock);
  queue.reset(won);
  queue.receive(last);
  assert.notEqual(queue.snapshot().game?.phase, "finished");
  clock.flush();
  assert.equal(queue.snapshot().game?.phase, "finished");
  assert.equal(queue.snapshot().active, undefined);
});
test("gaps, rematches, invisible screens and backlog overflow use a fresh confirmed snapshot", () => {
  const g = initial(),
    clock = new FakeClock(),
    queue = new PresentationQueue(options, clock);
  queue.reset(g);
  const gap = { ...g, revision: 4 };
  queue.receive(gap);
  assert.equal(queue.readyFor(gap), true);
  queue.receive({ ...g, revision: 3 });
  assert.equal(queue.snapshot().game, gap);
  queue.configure({ ...options, visible: false });
  const hidden = { ...g, revision: 5 };
  queue.receive(hidden);
  assert.equal(queue.readyFor(hidden), true);
  queue.configure(options);
  for (let i = 6; i <= 16; i++) queue.receive({ ...g, revision: i });
  assert.ok(queue.snapshot().game!.revision >= 14);
  clock.flush();
  assert.equal(queue.snapshot().game!.revision, 16);
  assert.equal(clock.tasks.size, 0);
  const rematch = { ...g, match: 2, revision: 0 };
  queue.receive(rematch);
  assert.equal(queue.readyFor(rematch), true);
});

test("travelling blocks retain distinct counter offsets through intermediate squares", () => {
  const from = moving(initial(), [10, 10, -1, -1], [0, -1, -1, -1], [3, 3]);
  const block = legalMoves(from).find((m) => m.kind === "block")!;
  const next = moveGame(from, "a", block.id);
  const transition = describeTransition(from, next);
  assert.equal(transition.journeys.length, 2);
  const [a, b] = transition.journeys;
  const offset = { x: b.token.x - a.token.x, y: b.token.y - a.token.y };
  assert.ok(Math.hypot(offset.x, offset.y) > 0);
  for (let i = 1; i < a.points.length - 1; i++) {
    assert.ok(Math.abs(b.points[i].x - a.points[i].x - offset.x) < 1e-10);
    assert.ok(Math.abs(b.points[i].y - a.points[i].y - offset.y) < 1e-10);
  }
});

test("War roll presentation includes bank gain and discarded overflow", () => {
  const base = initial();
  const g = createGame({ ...base.rules, mode: "war" }, base.players);
  g.war!.bank.a = 10;
  const rolled = rollGame(g, "a", [4, 5]);
  const t = describeTransition(g, rolled);
  assert.match(t.message, /\+2 power/);
  assert.match(t.message, /7 overflow lost/);
  assert.equal(g.war!.bank.a, 10);
  assert.equal(rolled.war!.bank.a, 12);
});
