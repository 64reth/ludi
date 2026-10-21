import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NoticeQueue,
  noticeDuration,
  type Notice,
} from "../packages/presentation/notices";
import {
  createGame,
  currentPlayer,
  rollGame,
  moveGame,
  legalMoves,
  timeoutGame,
  type Game,
} from "../packages/game-engine/index";
import { useSkill, legalSkills, purchaseSkill } from "../packages/war/index";
import {
  unavailable,
  windowReason,
  invalidTarget,
} from "../packages/war/guidance";
import { preset } from "../packages/rules/index";
class Clock {
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
      const task = [...this.tasks]
        .filter(([, t]) => t.at <= end)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!task) break;
      this.time = task[1].at;
      this.tasks.delete(task[0]);
      task[1].fn();
    }
    this.time = end;
  }
}
const notice = (id: string, tone: Notice["tone"], topic?: string): Notice => ({
  id,
  text: `Message ${id}`,
  tone,
  topic,
});
function game() {
  return createGame(
    {
      ...preset("don"),
      mode: "war",
      players: 2,
      sixRequired: false,
      slots: ["human", "human", "human", "human"],
    },
    [
      { id: "a", name: "Ada", colour: 0, computer: false },
      { id: "b", name: "Ben", colour: 1, computer: false },
    ],
  );
}
test("HUD durations are human-readable and significant messages queue without rapid replacement", () => {
  const clock = new Clock(),
    q = new NoticeQueue(clock);
  assert.deepEqual(
    ["ordinary", "war", "significant", "critical"].map((t) =>
      noticeDuration(t as Notice["tone"]),
    ),
    [4000, 6000, 8000, 0],
  );
  q.receive([
    notice("roll", "ordinary"),
    notice("bank", "war"),
    notice("cut", "significant"),
  ]);
  clock.advance(3999);
  assert.equal(q.snapshot().current?.id, "roll");
  clock.advance(1);
  assert.equal(q.snapshot().current?.id, "bank");
  clock.advance(5999);
  assert.equal(q.snapshot().current?.id, "bank");
  clock.advance(1);
  assert.equal(q.snapshot().current?.id, "cut");
  clock.advance(7999);
  assert.equal(q.snapshot().current?.id, "cut");
  clock.advance(1);
  assert.equal(q.snapshot().current, undefined);
  assert.equal(q.snapshot().history.length, 2);
});
test("Hover/focus/pause hold the remaining notification time; dismissal advances one card", () => {
  const clock = new Clock(),
    q = new NoticeQueue(clock);
  q.receive([notice("skill", "significant"), notice("next", "war")]);
  clock.advance(1500);
  q.pause(true);
  clock.advance(30000);
  assert.equal(q.snapshot().current?.id, "skill");
  q.pause(false);
  clock.advance(6499);
  assert.equal(q.snapshot().current?.id, "skill");
  clock.advance(1);
  assert.equal(q.snapshot().current?.id, "next");
  q.dismiss();
  assert.equal(q.snapshot().current, undefined);
  assert.equal(q.snapshot().history.length, 2);
});
test("Critical messages persist, obsolete locks are superseded and history survives bounded bursts", () => {
  const clock = new Clock(),
    q = new NoticeQueue(clock);
  q.receive([notice("lock", "critical", "lock")]);
  clock.advance(99999);
  assert.equal(q.snapshot().current?.id, "lock");
  q.receive([notice("open", "critical", "lock")]);
  assert.equal(q.snapshot().current?.id, "open");
  q.receive(Array.from({ length: 25 }, (_, i) => notice(String(i), "war")));
  assert.equal(q.snapshot().waiting, 8);
  assert.equal(q.snapshot().history.length, 27);
  q.reset([notice("restored", "war"), notice("oldmove", "ordinary")]);
  assert.equal(q.snapshot().history.length, 1);
  q.receive([notice("restored", "war")]);
  assert.equal(q.snapshot().waiting, 0);
});
test("Authority supplies bank, window, bonus, rotation, hazard and lock explanations with unique sequence numbers", () => {
  let g = game();
  g = rollGame(g, "a", [6, 6]);
  assert.ok(g.events.some((e) => e.topic === "bank" && /12/.test(e.text)));
  assert.ok(
    g.events.some((e) => e.topic === "window" && /closed/.test(e.text)),
  );
  while (g.phase === "move") g = moveGame(g, "a", legalMoves(g)[0].id);
  assert.equal(g.current, 0);
  assert.ok(g.events.some((e) => /bonus roll.*stays closed/.test(e.text)));
  g = timeoutGame(timeoutGame(g));
  assert.equal(g.war!.round, 2);
  assert.ok(g.events.some((e) => /now active/.test(e.text)));
  g.war!.bank.a = 12;
  g = purchaseSkill(g, "a", "lock");
  g = useSkill(g, "a", legalSkills(g).find((a) => a.skill === "lock")!.id);
  assert.ok(g.events.some((e) => e.topic === "lock" && e.tone === "critical"));
  g = timeoutGame(timeoutGame(g));
  assert.ok(g.events.some((e) => /Heaven Lock expired/.test(e.text)));
  const ids = g.events.flatMap((e) => (e.id === undefined ? [] : [e.id]));
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(
    ids,
    [...ids].sort((a, b) => a - b),
  );
});
test("Skill unavailability explains money, used turns, rolled windows, protected targets and existing locks", () => {
  let g = game();
  assert.match(unavailable(g, "guard"), /Need 3 more/);
  g.players[0].pieces[0] = 10;
  g.war!.bank.a = 12;
  g = purchaseSkill(g, "a", "guard");
  g = useSkill(g, "a", legalSkills(g).find((a) => a.skill === "guard")!.id);
  assert.match(windowReason(g), /Skill used/);
  g = timeoutGame(timeoutGame(g));
  g = rollGame(g, "a", [6, 2]);
  assert.match(windowReason(g), /Rolling closed/);
  assert.match(invalidTarget(g, "long", { owner: "b", piece: 0 }), /Yard/);
  g.players[1].pieces[0] = 20;
  g.war!.effects.push({ owner: "b", piece: 0, shield: true });
  assert.match(invalidTarget(g, "long", { owner: "b", piece: 0 }), /Guard Up/);
});
test("Movement penalties and defensive negations are confirmed events with counter and reason", () => {
  let g = game();
  g.players[0].pieces[0] = 5;
  g.war!.effects = [{ owner: "a", piece: 0, slow: 2 }];
  g = rollGame(g, "a", [4, 1]);
  g = moveGame(
    g,
    "a",
    legalMoves(g).find((m) => m.pieces[0] === 0 && m.to === 7)!.id,
  );
  assert.ok(
    g.events.some(
      (e) =>
        e.topic === "slow" && /Ada \(Red\) counter 1.*2 fewer/.test(e.text),
    ),
  );
});

test("Ordinary feedback cannot discard a queued capture, and pause at the deadline still expires on resume", () => {
  const clock = new Clock(),
    q = new NoticeQueue(clock);
  q.receive([notice("move", "ordinary"), notice("capture", "significant")]);
  q.receive([notice("anothermove", "ordinary")]);
  clock.advance(4000);
  assert.equal(q.snapshot().current?.id, "capture");
  clock.time += 8000;
  q.pause(true);
  q.pause(false);
  clock.advance(0);
  assert.equal(q.snapshot().current, undefined);
});

test("Separate authoritative bank events stay in history even when their wording repeats", () => {
  const q = new NoticeQueue(new Clock());
  q.receive([
    {
      id: "roll1",
      text: "Bank 12/12: overflow lost.",
      tone: "war",
      topic: "bank",
      round: 2,
    },
    {
      id: "roll2",
      text: "Bank 12/12: overflow lost.",
      tone: "war",
      topic: "bank",
      round: 2,
    },
  ]);
  assert.equal(q.snapshot().history.length, 2);
  q.receive([
    {
      id: "roll2",
      text: "Bank 12/12: overflow lost.",
      tone: "war",
      topic: "bank",
      round: 2,
    },
  ]);
  assert.equal(q.snapshot().history.length, 2);
});
