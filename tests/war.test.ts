import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  rollGame,
  moveGame,
  legalMoves,
  chooseMove,
  currentPlayer,
  timeoutGame,
  forfeitGame,
  cellId,
  type Game,
} from "../packages/game-engine/index";
import { preset } from "../packages/rules/index";
import {
  legalSkills,
  skillTargets,
  purchaseSkill,
  useSkill,
  cost,
  chooseSkill,
  trackDistance,
  effect,
  type Skill,
} from "../packages/war/index";
function setup(players = 2) {
  return createGame(
    {
      ...preset("don"),
      mode: "war",
      players,
      sixRequired: false,
      slots: ["human", "human", "human", "human"],
    },
    Array.from({ length: players }, (_, i) => ({
      id: `p${i}`,
      name: `Player ${i + 1}`,
      colour: i,
      computer: false,
    })),
  );
}
function fixture(a = [10, -1, -1, -1], b = [0, -1, -1, -1]) {
  const g = setup();
  g.players[0].pieces = a;
  g.players[1].pieces = b;
  g.war!.bank.p0 = 12;
  return g;
}
function buy(
  g: Game,
  s: Skill,
  predicate = (a: ReturnType<typeof legalSkills>[number]) => true,
) {
  g = purchaseSkill(g, currentPlayer(g).id, s);
  const a = legalSkills(g).find((a) => a.skill === s && predicate(a));
  assert.ok(a, `Expected ${s}`);
  return useSkill(g, currentPlayer(g).id, a.id);
}
test("War bank gains half the dice total, persists and never opens on bonus rolls", () => {
  let g = setup();
  g = rollGame(g, "p0", [6, 6]);
  assert.equal(g.war!.bank.p0, 6);
  assert.equal(g.war!.window, false);
  while (g.phase === "move") g = moveGame(g, "p0", legalMoves(g)[0].id);
  assert.equal(g.current, 0);
  assert.equal(g.war!.window, false);
  g = rollGame(g, "p0", [4, 5]);
  assert.equal(g.war!.bank.p0, 11);
  assert.match(g.war!.feedback, /\+5 power/);
  assert.equal(skillTargets(g).length, 0);
});
test("Every complete 2–4 player rotation advances one round, including skipped turns and forfeits", () => {
  for (const count of [2, 3, 4]) {
    let g = setup(count);
    for (let i = 0; i < count; i++) {
      assert.equal(g.war!.round, 1);
      g = timeoutGame(g);
    }
    assert.equal(g.war!.round, 2);
    assert.equal(g.war!.window, true);
    assert.equal(g.war!.active.length, 2);
    g = forfeitGame(g, "p1");
    if (count > 2) {
      for (let i = 0; i < count - 1; i++) g = timeoutGame(g);
      assert.ok(g.war!.round >= 3);
    }
  }
});
test("Skills validate before charging, share tempo price, escalate independently and only once a turn", () => {
  const g = fixture();
  assert.throws(() => useSkill(g, "p0", "forged"));
  assert.equal(g.war!.bank.p0, 12);
  let n = buy(g, "tempo", (a) => a.mode === "forward");
  assert.equal(n.war!.bank.p0, 6);
  assert.equal(cost(n, "tempo"), 9);
  assert.equal(cost(n, "guard"), 3);
  assert.equal(legalSkills(n).length, 0);
  n = timeoutGame(timeoutGame(n));
  n.war!.bank.p0 = 12;
  n = buy(n, "tempo", (a) => a.mode === "back");
  assert.equal(cost(n, "tempo"), 12);
  assert.equal(n.war!.bank.p0, 3);
  assert.throws(() => useSkill(n, "p1", "forged"));
  assert.deepEqual(g.war!.purchases.p0, {});
});
test("Guard absorbs a normal cut without overlap or false capture stats and expires at normal turn", () => {
  let g = fixture([5, -1, -1, -1], [47, -1, -1, -1]);
  g.war!.effects = [{ owner: "p1", piece: 0, shield: true }];
  g = rollGame(g, "p0", [3, 1]);
  const m = legalMoves(g).find((m) => m.to === 8)!;
  g = moveGame(g, "p0", m.id);
  assert.equal(g.players[0].pieces[0], 5);
  assert.equal(g.players[1].pieces[0], 47);
  assert.equal(g.players[0].captures, 0);
  assert.equal(effect(g, { owner: "p1", piece: 0 })?.shield, false);
  assert.match(g.events.at(-1)!.text, /Guard Up/);
  let s = buy(fixture(), "guard");
  assert.equal(effect(s, { owner: "p0", piece: 0 })?.shield, true);
  s = timeoutGame(timeoutGame(s));
  assert.equal(effect(s, { owner: "p0", piece: 0 })?.shield, false);
});
test("Track reach wraps correctly, cuts exposed counters only, Double Cut allows one or two", () => {
  assert.equal(trackDistance(51, 1), 2);
  let g = fixture([15, -1, -1, -1], [0, 1, -1, -1]);
  const source = Number(cellId(0, 15).slice(6));
  g.players[1].pieces = [
    (source + 2 - Number(cellId(1, 0).slice(6)) + 52) % 52,
    (source + 3 - Number(cellId(1, 0).slice(6)) + 52) % 52,
    -1,
    -1,
  ];
  assert.ok(
    skillTargets(g).some((a) => a.skill === "double" && a.targets.length === 1),
  );
  g = buy(g, "double", (a) => a.targets.length === 2);
  assert.deepEqual(g.players[1].pieces, [-1, -1, -1, -1]);
  assert.equal(g.players[0].captures, 2);
  const shield = fixture();
  shield.war!.effects = [{ owner: "p1", piece: 0, shield: true }];
  assert.ok(
    !skillTargets(shield).some((a) =>
      ["long", "double", "switch"].includes(a.skill),
    ),
  );
});
test("Switcheroo preserves track positions, excludes protected territory, blocks, yards and home", () => {
  const g = fixture([10, -1, -1, -1], [0, -1, -1, -1]);
  const a = skillTargets(g).find((a) => a.skill === "switch")!;
  assert.ok(a);
  const before = g.players.map((p) => cellId(p.colour, p.pieces[0]));
  const prepared = purchaseSkill(g, "p0", "switch");
  const n = useSkill(prepared, "p0", legalSkills(prepared).find((a) => a.skill === "switch")!.id);
  assert.equal(cellId(0, n.players[0].pieces[0]), before[1]);
  assert.equal(cellId(1, n.players[1].pieces[0]), before[0]);
  g.players[1].pieces = [0, 0, 51, 56];
  assert.ok(!skillTargets(g).some((a) => a.skill === "switch"));
});
test("Slows subtract at most three, retain at least one space, and expire after one move", () => {
  let g = fixture();
  g.war!.effects = [{ owner: "p0", piece: 0, slow: 3 }];
  g = rollGame(g, "p0", [2, 4]);
  assert.ok(legalMoves(g).some((m) => m.to === 11));
  const m = legalMoves(g).find((m) => m.to === 11)!;
  g = moveGame(g, "p0", m.id);
  assert.equal(effect(g, { owner: "p0", piece: 0 })?.slow, undefined);
  assert.ok(legalMoves(g).some((m) => m.from === 11 && m.to === 15));
});
test("Heaven Lock applies to every racer, never stacks, expires before caster’s next window", () => {
  let g = fixture([54, 56, 56, 56], [54, 56, 56, 56]);
  g = buy(g, "lock");
  assert.equal(g.war!.lock, "p0");
  g = rollGame(g, "p0", [2, 1]);
  assert.ok(legalMoves(g).every((m) => m.to !== 56));
  g = timeoutGame(g);
  g.war!.bank.p1 = 12;
  assert.ok(!skillTargets(g).some((a) => a.skill === "lock"));
  g = rollGame(g, "p1", [2, 1]);
  assert.ok(legalMoves(g).every((m) => m.to !== 56));
  g = timeoutGame(g);
  assert.equal(g.war!.lock, undefined);
  assert.equal(g.war!.window, true);
  g = rollGame(g, "p0", [2, 1]);
  assert.ok(legalMoves(g).some((m) => m.to === 56));
});
test("Hazards warn a full round ahead, activate for two rounds and never retroactively affect occupancy", () => {
  let g = setup();
  const announced = structuredClone(g.war!.incoming);
  const cell = announced[0].cell;
  g.players[0].pieces[0] = (cell - Number(cellId(0, 0).slice(6)) + 52) % 52;
  g = timeoutGame(timeoutGame(g));
  assert.deepEqual(g.war!.active, announced);
  assert.equal(g.war!.effects.length, 0);
  g = timeoutGame(timeoutGame(g));
  assert.equal(g.war!.round, 3);
  assert.equal(g.war!.incoming.length, 2);
  assert.deepEqual(g.war!.active, announced);
  const incoming = structuredClone(g.war!.incoming);
  g = timeoutGame(timeoutGame(g));
  assert.deepEqual(g.war!.active, incoming);
});
test("Slipstream, Quicksand and Danger Tile resolve legal landings without direct Heaven finish", () => {
  for (const kind of ["slip", "sand", "danger"] as const) {
    let g = fixture([5, -1, -1, -1], [-1, -1, -1, -1]);
    g.war!.active = [{ kind, cell: Number(cellId(0, 8).slice(6)) }];
    g = rollGame(g, "p0", [3, 1]);
    g = moveGame(g, "p0", legalMoves(g).find((m) => m.to === 8)!.id);
    assert.equal(g.players[0].pieces[0], kind === "slip" ? 10 : 8);
    if (kind === "sand")
      assert.equal(effect(g, { owner: "p0", piece: 0 })?.slow, 2);
    if (kind === "danger")
      assert.equal(
        effect(g, { owner: "p0", piece: 0 })?.danger,
        Number(cellId(0, 8).slice(6)),
      );
  }
  const g = fixture([54, 56, 56, 56]);
  assert.ok(
    skillTargets(g)
      .filter((a) => a.mode === "forward")
      .every((a) => a.to !== 56),
  );
});
test("Complete deterministic War matches for 2–4 players finish with legal skills, hazards and bounded banks", () => {
  for (const count of [2, 3, 4]) {
    let g = setup(count),
      seed = 7,
      used = 0;
    const die = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return (seed % 6) + 1;
    };
    for (let i = 0; i < 9000 && g.phase !== "finished"; i++) {
      const a = chooseSkill(g);
      if (a) {
        g = useSkill(g, currentPlayer(g).id, a.id);
        used++;
      } else if (g.phase === "roll")
        g = rollGame(g, currentPlayer(g).id, [die(), die()]);
      else g = moveGame(g, currentPlayer(g).id, chooseMove(g)!.id);
      assert.ok(Object.values(g.war!.bank).every((v) => v >= 0 && v <= 12));
      assert.ok(g.war!.active.length <= 2);
      assert.ok(
        g.players.every((p) =>
          p.pieces.every((v) => Number.isInteger(v) && v >= -1 && v <= 56),
        ),
      );
    }
    assert.equal(g.phase, "finished");
    assert.ok(used > 0);
    assert.ok(g.war!.round > 3);
  }
});

test("Purchased attacks cannot target safe terrain, home lanes or a blockade", () => {
  const g = fixture([15, -1, -1, -1], [3, 3, 51, 56]);
  g.rules.safeSquares = true;
  assert.ok(
    !skillTargets(g).some((a) => ["long", "double", "switch"].includes(a.skill)),
  );
  g.players[1].pieces = [5, 51, 56, -1];
  assert.equal(cellId(1, 5), "track-8");
  assert.ok(
    !skillTargets(g).some((a) => ["long", "double", "switch"].includes(a.skill)),
  );
});
test("Draw Back is absorbed by Guard Up and cannot stack a slow", () => {
  const g = fixture();
  g.war!.effects = [{ owner: "p1", piece: 0, shield: true }];
  const n = buy(g, "tempo", (a) => a.mode === "back");
  assert.equal(effect(n, { owner: "p1", piece: 0 })?.shield, false);
  assert.equal(effect(n, { owner: "p1", piece: 0 })?.slow, undefined);
  g.war!.effects = [{ owner: "p1", piece: 0, slow: 2 }];
  assert.ok(!skillTargets(g).some((a) => a.mode === "back"));
});
test("Fast Forward respects blockades, home-entry qualification and cannot finish", () => {
  const g = fixture([5, -1, -1, -1], [46, 46, -1, -1]);
  assert.ok(!skillTargets(g).some((a) => a.mode === "forward" && a.to! >= 7));
  g.players[0].pieces = [50, -1, -1, -1];
  g.rules.blockBeforeHome = true;
  assert.ok(!skillTargets(g).some((a) => a.mode === "forward"));
  g.players[0].homeUnlocked = true;
  assert.ok(skillTargets(g).some((a) => a.mode === "forward"));
});
test("Danger removes ordinary safe-square protection only after landing and preserves Guard Up", () => {
  let g = fixture([15, -1, -1, -1], [5, -1, -1, -1]);
  g.rules.safeSquares = true;
  g = rollGame(g, "p0", [3, 1]);
  assert.ok(!legalMoves(g).some((m) => m.to === 18));
  g.war!.effects = [{ owner: "p1", piece: 0, danger: 8, shield: true }];
  const m = legalMoves(g).find((m) => m.to === 18)!;
  assert.ok(m);
  g = moveGame(g, "p0", m.id);
  assert.equal(g.players[1].pieces[0], 5);
  assert.equal(effect(g, { owner: "p1", piece: 0 })?.shield, false);
});

test("Slipstream carries an intact doubles block along a legal route", () => {
  let g = fixture([5, 5, -1, -1], [-1, -1, -1, -1]);
  g.war!.active = [{ kind: "slip", cell: Number(cellId(0, 8).slice(6)) }];
  g = rollGame(g, "p0", [3, 3]);
  const m = legalMoves(g).find((m) => m.kind === "block" && m.to === 8)!;
  assert.ok(m);
  g = moveGame(g, "p0", m.id);
  assert.deepEqual(g.players[0].pieces.slice(0, 2), [10, 10]);
});

test("A forfeited Heaven Lock caster cannot leave a permanent seal on remaining racers", () => {
  let g = setup(3);
  g.war!.bank.p0 = 12;
  g = buy(g, "lock");
  g = timeoutGame(g);
  assert.equal(g.war!.lock, "p0");
  g = forfeitGame(g, "p0");
  assert.equal(g.phase, "roll");
  assert.equal(g.war!.lock, undefined);
});
test("Switcheroo landings activate hazards for exchanged counters", () => {
  let g = fixture();
  const to = Number(cellId(1, g.players[1].pieces[0]).slice(6));
  g.war!.active = [{ kind: "sand", cell: to }];
  g = buy(g, "switch");
  assert.equal(effect(g, { owner: "p0", piece: 0 })?.slow, 2);
  assert.match(g.war!.feedback, /Quicksand/);
});

test("Half-total income rounds up for every colour, with capped overflow", () => {
  for (const [dice, earned] of [[[1, 1], 1], [[2, 3], 3], [[3, 4], 4], [[4, 5], 5], [[6, 6], 6]] as const) {
    for (let colour = 0; colour < 4; colour++) {
      const g = setup(4);
      g.current = colour;
      const id = currentPlayer(g).id;
      const n = rollGame(g, id, [...dice]);
      assert.equal(n.war!.bank[id], earned);
      g.war!.bank[id] = 11;
      const capped = rollGame(g, id, [...dice]);
      assert.equal(capped.war!.bank[id], 12);
      if (earned > 1) assert.match(capped.war!.feedback, new RegExp(`${earned - 1} overflow lost`));
    }
  }
});

test("Prepared slot can be bought without targets, held across rounds and deployed later for free", () => {
  let g = setup();
  g.war!.bank.p0 = 12;
  assert.equal(legalSkills(g).length, 0);
  g = purchaseSkill(g, "p0", "long");
  assert.equal(g.war!.bank.p0, 3);
  assert.equal(g.war!.prepared!.p0, "long");
  assert.equal(legalSkills(g).length, 0);
  assert.throws(() => purchaseSkill(g, "p0", "guard"));
  assert.throws(() => purchaseSkill(g, "p1", "guard"));
  g = rollGame(g, "p0", [6, 6]);
  assert.equal(g.war!.prepared!.p0, "long");
  assert.equal(legalSkills(g).length, 0);
  g = timeoutGame(timeoutGame(g));
  g.players[0].pieces[0] = 10;
  g.players[1].pieces[0] = 0;
  const action = legalSkills(g).find((a) => a.skill === "long")!;
  assert.ok(action);
  const bank = g.war!.bank.p0;
  const count = g.war!.purchases.p0.long;
  assert.throws(() => useSkill(g, "p0", "forged"));
  g = useSkill(g, "p0", action.id);
  assert.equal(g.war!.prepared!.p0, undefined);
  assert.equal(g.war!.bank.p0, bank);
  assert.equal(g.war!.purchases.p0.long, count);
  assert.throws(() => purchaseSkill(g, "p0", "guard"));
  assert.throws(() => useSkill(g, "p0", action.id));
});

test("Purchase and deployment in one window charge once and reject repeat sequences", () => {
  const initial = fixture();
  const g = purchaseSkill(initial, "p0", "guard");
  assert.equal(initial.war!.prepared!.p0, undefined);
  assert.equal(g.war!.window, true);
  const n = useSkill(g, "p0", legalSkills(g)[0].id);
  assert.equal(n.war!.bank.p0, 9);
  assert.equal(n.war!.purchases.p0.guard, 1);
  assert.equal(n.war!.window, false);
  assert.throws(() => purchaseSkill(n, "p0", "tempo"));
  assert.throws(() => purchaseSkill(initial, "p0", "invalid" as Skill));
});
