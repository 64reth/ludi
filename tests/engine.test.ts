import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  rollGame,
  moveGame,
  legalMoves,
  chooseMove,
  cellId,
  passGame,
  timeoutGame,
  forfeitGame,
  type Game,
} from "../packages/game-engine/index";
import { preset, type Rules } from "../packages/rules/index";
const rules = (r: Partial<Rules> = {}): Rules => ({
  ...preset("don"),
  players: 2,
  slots: ["human", "human", "human", "human"],
  ...r,
});
const seats = [
  { id: "a", name: "Red", colour: 0, computer: false },
  { id: "b", name: "Green", colour: 1, computer: false },
];
function fixture(
  a: number[],
  b: number[],
  dice: [number, number],
  r: Partial<Rules> = {},
): Game {
  const g = createGame(rules(r), seats);
  g.players[0].pieces = a;
  g.players[1].pieces = b;
  g.dice = dice;
  g.remaining = [0, 1];
  g.phase = "move";
  return g;
}
const play = (g: Game, m = legalMoves(g)[0]) =>
  moveGame(g, g.players[g.current].id, m.id);
test("entry, split dice, bonuses and input immutability", () => {
  const start = createGame(rules(), seats);
  assert.equal(rollGame(start, "a", [2, 3]).current, 1);
  const rolled = rollGame(start, "a", [6, 3]);
  const released = play(
    rolled,
    legalMoves(rolled).find((m) => m.kind === "enter")!,
  );
  assert.equal(released.players[0].pieces[0], 0);
  assert.equal(released.remaining.length, 1);
  const moved = play(released);
  assert.equal(moved.players[0].pieces[0], 3);
  assert.equal(moved.current, 0);
  assert.equal(moved.phase, "roll");
  assert.equal(start.dice, null);
  assert.throws(() => rollGame(start, "b", [6, 6]), /turn/);
  assert.throws(() => rollGame(start, "a", [7, 1]), /integers/);
  assert.throws(() => moveGame(rolled, "a", "forged"), /legal/);
});
test("open entry and compulsory release change legal actions", () => {
  let g = fixture([-1, 10, -1, -1], [-1, -1, -1, -1], [6, 3]);
  assert.ok(legalMoves(g).some((m) => m.kind === "move"));
  g.rules.compulsoryEntry = true;
  assert.ok(legalMoves(g).every((m) => m.kind === "enter"));
  const opened = rollGame(
    createGame(rules({ sixRequired: false }), seats),
    "a",
    [2, 4],
  );
  assert.ok(legalMoves(opened).some((m) => m.kind === "enter"));
});
test("captures, safe squares, gates and capture toggle", () => {
  const g = fixture([5, -1, -1, -1], [47, -1, -1, -1], [3, 1]);
  const cut = legalMoves(g).find((m) => m.to === 8)!;
  assert.equal(cut.captures.length, 1);
  assert.equal(play(g, cut).players[1].pieces[0], -1);
  g.rules.captureSingles = false;
  assert.ok(!legalMoves(g).some((m) => m.to === 8));
  const safe = fixture([0, -1, -1, -1], [5, -1, -1, -1], [5, 1], {
    safeSquares: true,
  });
  assert.equal(cellId(0, 5), "track-47"); // Different safe fixture uses track-8.
  const s = fixture([16, -1, -1, -1], [5, -1, -1, -1], [2, 1], {
    safeSquares: true,
  });
  assert.ok(!legalMoves(s).some((m) => m.to === 18));
  s.rules.safeSquares = false;
  assert.ok(legalMoves(s).some((m) => m.to === 18));
  const gate = fixture([11, -1, -1, -1], [0, -1, -1, -1], [2, 1], {
    protectedGates: true,
    gateBlocking: false,
  });
  assert.ok(!legalMoves(gate).some((m) => m.to === 13));
});
test("blocking threshold, passage, maximum and gate placement", () => {
  const g = fixture([3, -1, -1, -1], [44, 44, -1, -1], [4, 2]);
  assert.ok(!legalMoves(g).some((m) => m.to === 7));
  g.rules.blockPassage = false;
  assert.ok(legalMoves(g).some((m) => m.to === 7));
  g.rules.blockSize = 3;
  g.rules.maxBlock = 3;
  assert.ok(legalMoves(g).some((m) => m.to === 5 && m.captures.length === 2));
  const full = fixture([3, 5, 5, -1], [-1, -1, -1, -1], [2, 1]);
  assert.ok(!legalMoves(full).some((m) => m.pieces[0] === 0 && m.to === 5));
  full.rules.maxBlock = 3;
  assert.ok(legalMoves(full).some((m) => m.pieces[0] === 0 && m.to === 5));
  const gate = fixture([11, 13, -1, -1], [-1, -1, -1, -1], [2, 1], {
    gateBlocking: false,
  });
  assert.ok(!legalMoves(gate).some((m) => m.pieces[0] === 0 && m.to === 13));
  gate.rules.gateBlocking = true;
  assert.ok(legalMoves(gate).some((m) => m.pieces[0] === 0 && m.to === 13));
});
test("doubles move an intact block once; special block cuts are explicit", () => {
  const g = fixture([10, 10, -1, -1], [0, -1, -1, -1], [3, 3]);
  const block = legalMoves(g).find((m) => m.kind === "block")!;
  assert.equal(block.to, 13);
  assert.equal(block.dice.length, 2);
  const moved = play(g, block);
  assert.deepEqual(moved.players[0].pieces.slice(0, 2), [13, 13]);
  g.rules.moveBlocks = false;
  assert.ok(!legalMoves(g).some((m) => m.kind === "block"));
  const capture = fixture([10, 10, -1, -1], [0, 0, -1, -1], [3, 3], {
    blockCapture: "equal block on doubles",
  });
  assert.equal(
    legalMoves(capture).find((m) => m.kind === "block")!.captures.length,
    2,
  );
  capture.rules.blockCapture = "never";
  assert.ok(!legalMoves(capture).some((m) => m.kind === "block"));
});
test("home prerequisite unlocks a colour, exact/combined finish, and victory", () => {
  let g = fixture([50, 49, -1, -1], [-1, -1, -1, -1], [1, 2], {
    blockBeforeHome: true,
  });
  assert.ok(!legalMoves(g).some((m) => m.pieces[0] === 0));
  g = play(
    g,
    legalMoves(g).find((m) => m.pieces[0] === 1 && m.to === 50)!,
  );
  assert.equal(g.players[0].homeUnlocked, true);
  assert.ok(legalMoves(g).some((m) => m.to === 52));
  let finish = fixture([54, 56, 56, 56], [-1, -1, -1, -1], [1, 1], {
    combinedFinish: true,
  });
  assert.ok(
    legalMoves(finish).some((m) => m.kind === "combine" && m.to === 56),
  );
  const won = play(
    finish,
    legalMoves(finish).find((m) => m.kind === "combine")!,
  );
  assert.equal(won.winnerId, "a");
  assert.equal(won.phase, "finished");
  assert.throws(() => rollGame(won, "a", [1, 1]), /finished/);
  finish = fixture([55, 56, 56, 56], [-1, -1, -1, -1], [2, 3]);
  assert.equal(legalMoves(finish).length, 0);
  finish.rules.exactFinish = false;
  assert.ok(legalMoves(finish).some((m) => m.to === 56));
});
test("combined movement and independent combined finishing permission", () => {
  const g = fixture([10, -1, -1, -1], [-1, -1, -1, -1], [2, 3]);
  assert.ok(!legalMoves(g).some((m) => m.kind === "combine"));
  g.rules.combined = "combined permitted";
  assert.ok(legalMoves(g).some((m) => m.kind === "combine" && m.to === 15));
  const f = fixture([51, -1, -1, -1], [-1, -1, -1, -1], [2, 3], {
    combined: "combined permitted",
  });
  assert.ok(!legalMoves(f).some((m) => m.kind === "combine"));
  f.rules.combinedFinish = true;
  assert.ok(legalMoves(f).some((m) => m.kind === "combine" && m.to === 56));
});
test("optional/compulsory dice use, penalties, double-six credits and timers", () => {
  const g = fixture([10, -1, -1, -1], [-1, -1, -1, -1], [2, 3]);
  assert.throws(() => passGame(g, "a"), /legal dice/);
  g.rules.useBoth = false;
  assert.equal(passGame(g, "a").current, 1);
  const timed = timeoutGame(g);
  assert.equal(timed.current, 1);
  assert.equal(timed.events.at(-2)?.kind, "timeout");
  let six = createGame(rules({ sixPenalty: "third throw ends turn" }), seats);
  for (let i = 0; i < 3; i++) {
    six = rollGame(six, "a", [6, 1]);
    while (six.phase === "move") six = play(six, chooseMove(six));
  }
  assert.equal(six.current, 1);
  assert.ok(six.events.some((e) => e.text.includes("Three consecutive")));
  let doubles = rollGame(
    createGame(rules({ doubleSix: "two" }), seats),
    "a",
    [6, 6],
  );
  while (doubles.phase === "move") doubles = play(doubles, chooseMove(doubles));
  assert.equal(doubles.bonus, 1);
  const forfeited = forfeitGame(g, "b");
  assert.equal(forfeited.winnerId, "a");
});
test("full deterministic matches finish with legal AI for both presets and 2–4 players", () => {
  for (const id of ["don", "life"] as const)
    for (const count of [2, 3, 4]) {
      const r = {
        ...preset(id),
        players: count,
        slots: ["human", "computer", "computer", "computer"] as Rules["slots"],
      };
      const setup = Array.from({ length: count }, (_, i) => ({
        id: String(i),
        name: "Player " + i,
        colour: i,
        computer: i > 0,
      }));
      let g = createGame(r, setup);
      let seed = 12345;
      let actions = 0;
      const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return 1 + (seed % 6);
      };
      while (g.phase !== "finished" && actions++ < 16000) {
        const who = g.players[g.current].id;
        if (g.phase === "roll") g = rollGame(g, who, [random(), random()]);
        else {
          const m = chooseMove(g);
          assert.ok(m);
          g = moveGame(g, who, m.id);
        }
        for (const p of g.players)
          assert.ok(
            p.pieces.every((v) => Number.isInteger(v) && v >= -1 && v <= 56),
          );
      }
      assert.ok(
        g.winnerId,
        `${id} ${count} did not finish in ${actions} actions`,
      );
      assert.ok(
        g.players
          .find((p) => p.id === g.winnerId)!
          .pieces.every((v) => v === 56),
      );
    }
});
test("both-dice enforcement searches ordering-dependent home-block qualification", () => {
  const g = fixture([47, 50, 50, -1], [-1, -1, -1, -1], [2, 3], {
    blockBeforeHome: true,
    blockSize: 3,
    maxBlock: 3,
  });
  assert.ok(legalMoves(g).every((m) => m.to === 50));
  g.rules.useBoth = false;
  assert.ok(legalMoves(g).some((m) => m.to === 49));
});
test("configured colours determine clockwise turns, and rosters must match controller slots", () => {
  const g = createGame(
    rules({ players: 3, slots: ["human", "human", "human", "human"] }),
    [
      { ...seats[0], colour: 3 },
      { ...seats[1], colour: 0 },
      { id: "c", name: "Gold", colour: 2, computer: false },
    ],
  );
  const next = rollGame(g, "a", [1, 2]);
  assert.equal(next.players[next.current].id, "b");
  const third = rollGame(next, "b", [1, 2]);
  assert.equal(third.players[third.current].id, "c");
  assert.throws(
    () =>
      createGame(
        rules({ slots: ["human", "computer", "human", "human"] }),
        seats,
      ),
    /controllers/,
  );
});
