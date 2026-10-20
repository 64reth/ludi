import { recordEvent, counterLabel, playerLabel } from "./events";
import {
  createWar,
  warTurn,
  warRoll,
  penalty,
  dangerous,
  effect,
  afterMove,
  type War,
} from "../war/index";
import { validate, type Rules } from "../rules/index";
import { gates } from "../board/geometry";
export const FINISH = 56,
  HOME_ENTRY = 50;
export type Seat = {
  id: string;
  name: string;
  colour: number;
  computer: boolean;
};
export type Racer = Seat & {
  pieces: number[];
  homeUnlocked: boolean;
  forfeited: boolean;
  captures: number;
  blocks: number;
  finished: number;
};
export type GameEvent = {
  id?: number;
  round?: number;
  tone?: import("./events").EventTone;
  topic?: string;
  kind:
    | "war"
    | "roll"
    | "move"
    | "capture"
    | "block"
    | "home"
    | "finish"
    | "turn"
    | "timeout"
    | "forfeit"
    | "win";
  text: string;
};
export type Game = {
  version: 1;
  war?: War;
  match: number;
  rules: Rules;
  players: Racer[];
  current: number;
  phase: "roll" | "move" | "finished";
  dice: [number, number] | null;
  remaining: number[];
  bonus: number;
  sixStreak: number;
  turn: number;
  rollNumber: number;
  revision: number;
  winnerId?: string;
  events: GameEvent[];
  eventSerial?: number;
};
export type Move = {
  id: string;
  playerId: string;
  pieces: number[];
  dice: number[];
  from: number;
  to: number;
  kind: "enter" | "move" | "block" | "combine";
  captures: { player: number; piece: number }[];
  formsBlock: boolean;
};
export function createGame(rules: Rules, seats: Seat[], match = 1): Game {
  const errors = validate(rules);
  if (errors.length) throw Error(errors.join(" "));
  if (seats.some((p, i) => p.computer !== (rules.slots[i] === "computer")))
    throw Error("Player controllers must match the configured slots.");
  if (
    seats.length !== rules.players ||
    new Set(seats.map((p) => p.id)).size !== seats.length ||
    new Set(seats.map((p) => p.colour)).size !== seats.length ||
    seats.some(
      (p) =>
        !Number.isInteger(p.colour) ||
        p.colour < 0 ||
        p.colour > 3 ||
        !p.name.trim() ||
        p.name.length > 30,
    )
  )
    throw Error("Choose two to four unique players and colours.");
  const game: Game = {
    version: 1,
    match,
    rules: structuredClone(rules),
    players: seats.map((p) => ({
      ...p,
      pieces: [-1, -1, -1, -1],
      homeUnlocked: false,
      forfeited: false,
      captures: 0,
      blocks: 0,
      finished: 0,
    })),
    current: (match - 1) % seats.length,
    phase: "roll",
    dice: null,
    remaining: [],
    bonus: 0,
    sixStreak: 0,
    turn: 1,
    rollNumber: 0,
    revision: 0,
    events: [
      {
        kind: "turn",
        text: `${seats[(match - 1) % seats.length].name} starts. Roll both dice.`,
      },
    ],
  };
  if (rules.mode === "war") {
    game.war = createWar(game);
    recordEvent(
      game,
      "war",
      `War Bank starts at 0/12. Roll to earn points; skills are purchased before rolling on a later normal turn.`,
      "war",
      "bank",
    );
    recordEvent(
      game,
      "war",
      "Dashed hazard markers are incoming: Slipstream and Quicksand activate in round 2. Starting arrows are permanent entry markings.",
      "war",
      "hazard",
    );
  }
  return game;
}
export function cellId(colour: number, progress: number, piece = 0): string {
  if (progress < 0) return `yard-${colour}-${piece}`;
  if (progress <= 50) return `track-${(gates[colour] + progress) % 52}`;
  if (progress < FINISH) return `home-${colour}-${progress - 51}`;
  return `finish-${colour}`;
}
export function currentPlayer(g: Game) {
  return g.players[g.current];
}
function event(g: Game, kind: GameEvent["kind"], text: string) {
  if (g.war) {
    recordEvent(
      g,
      kind,
      text,
      kind === "win"
        ? "critical"
        : ["capture", "block", "home", "finish", "forfeit"].includes(kind)
          ? "significant"
          : "ordinary",
    );
    return;
  }
  g.events = [...g.events, { kind, text }].slice(-14);
}
function checkActor(g: Game, actor: string) {
  if (g.phase === "finished") throw Error("This match has finished.");
  if (currentPlayer(g).id !== actor || currentPlayer(g).forfeited)
    throw Error("Wait for your turn.");
}
function occupants(g: Game, cell: string) {
  const found: { player: number; piece: number }[] = [];
  for (let p = 0; p < g.players.length; p++) {
    const racer = g.players[p];
    if (racer.forfeited) continue;
    for (let i = 0; i < 4; i++)
      if (
        racer.pieces[i] >= 0 &&
        racer.pieces[i] <= 50 &&
        cellId(racer.colour, racer.pieces[i]) === cell
      )
        found.push({ player: p, piece: i });
  }
  return found;
}
function protectedCell(g: Game, cell: string) {
  if (g.war && dangerous(g, cell)) return false;
  const n = Number(cell.slice(6));
  return (
    (g.rules.safeSquares && [8, 21, 34, 47].includes(n)) ||
    (g.rules.protectedGates && gates.includes(n))
  );
}
function hasPermit(g: Game, p: Racer) {
  return (
    !g.rules.blockBeforeHome ||
    p.homeUnlocked ||
    p.pieces.filter((v) => v === HOME_ENTRY).length >= g.rules.blockSize
  );
}
function buildMove(
  g: Game,
  pieces: number[],
  dice: number[],
  kind: Move["kind"],
): Move | undefined {
  const p = currentPlayer(g),
    r = g.rules,
    from = p.pieces[pieces[0]];
  const nominal =
    kind === "block"
      ? g.dice![dice[0]]
      : dice.reduce((n, i) => n + g.dice![i], 0);
  const distance =
    from < 0 ? nominal : Math.max(1, nominal - penalty(g, pieces));
  if (from === FINISH) return;
  if (from < 0 && (kind !== "enter" || (r.sixRequired && distance !== 6)))
    return;
  const rawTo = from < 0 ? 0 : from + distance;
  if (rawTo > FINISH && r.exactFinish) return;
  const to = Math.min(FINISH, rawTo);
  if (g.war?.lock && to === FINISH) return;
  if (kind === "combine" && to === FINISH && r.exactFinish && !r.combinedFinish)
    return;
  if (from <= HOME_ENTRY && to > HOME_ENTRY && !hasPermit(g, p)) return;
  let captures: Move["captures"] = [];
  let formsBlock = false;
  for (let step = from < 0 ? 0 : from + 1; step <= Math.min(to, 50); step++) {
    const cell = cellId(p.colour, step),
      others = occupants(g, cell).filter((o) => o.player !== g.current);
    const enemyBlock = others.length >= r.blockSize;
    const landing = step === to;
    const canCutBlock =
      landing &&
      kind === "block" &&
      r.blockCapture === "equal block on doubles" &&
      others.length === pieces.length &&
      !protectedCell(g, cell);
    if (!landing && enemyBlock && r.blockPassage) return;
    if (landing && others.length) {
      if (
        enemyBlock ? !canCutBlock : !r.captureSingles || protectedCell(g, cell)
      )
        return;
      captures = others;
    }
  }
  if (to <= 50) {
    const friends = p.pieces.filter(
      (v, i) => v === to && !pieces.includes(i),
    ).length;
    if (friends + pieces.length > r.maxBlock) return;
    const total = friends + pieces.length;
    const otherGate = g.players.some(
      (o) =>
        !o.forfeited &&
        o.id !== p.id &&
        gates[o.colour] === Number(cellId(p.colour, to).slice(6)),
    );
    if (total >= r.blockSize && otherGate && !r.gateBlocking) return;
    formsBlock =
      kind !== "block" && total >= r.blockSize && friends < r.blockSize;
  }
  return {
    id: `${g.match}:${g.revision}:${pieces.join(".")}:${dice.join(".")}:${kind}`,
    playerId: p.id,
    pieces,
    dice,
    from,
    to,
    kind,
    captures,
    formsBlock,
  };
}
function rawMoves(g: Game): Move[] {
  if (g.phase !== "move" || !g.dice) return [];
  const p = currentPlayer(g);
  const moves: Move[] = [];
  for (let i = 0; i < 4; i++)
    for (const d of g.remaining) {
      const m = buildMove(g, [i], [d], p.pieces[i] < 0 ? "enter" : "move");
      if (m) moves.push(m);
    }
  if (g.remaining.length === 2) {
    for (let i = 0; i < 4; i++)
      if (p.pieces[i] >= 0) {
        const target = p.pieces[i] + g.dice[0] + g.dice[1];
        if (
          g.rules.combined === "combined permitted" ||
          (g.rules.combinedFinish && target === FINISH)
        ) {
          const m = buildMove(g, [i], [...g.remaining], "combine");
          if (m) moves.push(m);
        }
      }
    if (g.rules.moveBlocks && g.dice[0] === g.dice[1]) {
      const positions = new Set(p.pieces.filter((v) => v >= 0 && v <= 50));
      for (const position of positions) {
        const group = p.pieces.flatMap((v, i) => (v === position ? [i] : []));
        if (group.length >= g.rules.blockSize) {
          const m = buildMove(g, group, [...g.remaining], "block");
          if (m) moves.push(m);
        }
      }
    }
  }
  const forced =
    g.rules.compulsoryEntry && moves.some((m) => m.kind === "enter")
      ? moves.filter((m) => m.kind === "enter")
      : moves;
  const seen = new Set<string>();
  return forced.filter((m) => {
    const key = `${m.pieces}:${m.to}:${m.kind}:${m.dice.map((i) => g.dice![i]).sort()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function execute(g: Game, m: Move): Game {
  const n = structuredClone(g),
    p = currentPlayer(n);
  p.homeUnlocked =
    p.homeUnlocked ||
    p.pieces.filter((v) => v === HOME_ENTRY).length >= n.rules.blockSize;
  const guarded = m.captures.filter(
    (c) => effect(n, { owner: n.players[c.player].id, piece: c.piece })?.shield,
  );
  if (guarded.length) {
    for (const piece of m.pieces) {
      const e = effect(n, { owner: p.id, piece });
      if (e) delete e.slow;
    }
    for (const c of guarded)
      effect(n, { owner: n.players[c.player].id, piece: c.piece })!.shield =
        false;
    n.remaining = n.remaining.filter((d) => !m.dice.includes(d));
    return n;
  }
  for (const i of m.pieces) p.pieces[i] = m.to;
  for (const c of m.captures) n.players[c.player].pieces[c.piece] = -1;
  p.homeUnlocked =
    p.homeUnlocked ||
    p.pieces.filter((v) => v === HOME_ENTRY).length >= n.rules.blockSize;
  afterMove(n, m);
  n.remaining = n.remaining.filter((d) => !m.dice.includes(d));
  return n;
}
function bestUsage(g: Game): number {
  const moves = rawMoves(g);
  return moves.length
    ? Math.max(...moves.map((m) => m.dice.length + bestUsage(execute(g, m))))
    : 0;
}
export function legalMoves(g: Game): Move[] {
  const moves = rawMoves(g);
  if (!g.rules.useBoth) return moves;
  const scores = moves.map((m) => m.dice.length + bestUsage(execute(g, m)));
  const maximum = Math.max(0, ...scores);
  return moves.filter((_, i) => scores[i] === maximum);
}
function nextPlayer(g: Game) {
  const ended = currentPlayer(g).id;
  const order = g.players
    .map((_, i) => i)
    .sort((a, b) => g.players[a].colour - g.players[b].colour);
  do {
    g.current = order[(order.indexOf(g.current) + 1) % order.length];
  } while (currentPlayer(g).forfeited);
  g.phase = "roll";
  g.remaining = [];
  g.bonus = 0;
  g.sixStreak = 0;
  g.turn++;
  warTurn(g, ended);
  event(g, "turn", `${currentPlayer(g).name} to roll.`);
}
function endRoll(g: Game) {
  g.remaining = [];
  if (g.bonus > 0) {
    g.bonus--;
    g.phase = "roll";
    event(g, "turn", `${currentPlayer(g).name} has a bonus roll.`);
    if (g.war)
      recordEvent(
        g,
        "war",
        `${playerLabel(g, currentPlayer(g).id)} has a bonus roll. The skill window stays closed until their next normal turn after the table rotates.`,
        "war",
        "window",
      );
  } else nextPlayer(g);
}
export function rollGame(g: Game, actor: string, dice: [number, number]): Game {
  checkActor(g, actor);
  if (g.phase !== "roll") throw Error("Play the remaining dice first.");
  if (
    dice.length !== 2 ||
    dice.some((d) => !Number.isInteger(d) || d < 1 || d > 6)
  )
    throw Error("Dice must be two integers from one to six.");
  const n = structuredClone(g);
  warRoll(n, dice);
  n.dice = [...dice];
  n.remaining = [0, 1];
  n.phase = "move";
  n.rollNumber++;
  n.revision++;
  const six = dice.includes(6),
    doubles = dice[0] === 6 && dice[1] === 6;
  n.sixStreak = six ? n.sixStreak + 1 : 0;
  event(
    n,
    "roll",
    `${currentPlayer(n).name} rolled ${dice[0]} and ${dice[1]}.`,
  );
  if (n.rules.sixPenalty === "third throw ends turn" && n.sixStreak >= 3) {
    event(n, "turn", "Three consecutive throws with a six: turn forfeited.");
    nextPlayer(n);
    return n;
  }
  if (doubles)
    n.bonus +=
      n.rules.doubleSix === "two" ? 2 : n.rules.doubleSix === "one" ? 1 : 0;
  else if (six && n.rules.extraSix) n.bonus++;
  if (n.war?.lock && currentPlayer(n).pieces.some((v) => v >= 51 && v < 56))
    recordEvent(
      n,
      "war",
      `Heaven is sealed by ${playerLabel(n, n.war.lock)}. Nobody can finish until that player’s next normal turn; legal home-lane moves are still allowed.`,
      "critical",
      "lock",
    );
  if (!legalMoves(n).length) {
    event(n, "move", "No legal move with these dice.");
    endRoll(n);
  }
  return n;
}
export function moveGame(g: Game, actor: string, id: string): Game {
  checkActor(g, actor);
  const m = legalMoves(g).find((m) => m.id === id);
  if (!m) throw Error("That move is no longer legal.");
  const n = execute(g, m),
    p = currentPlayer(n);
  n.revision++;
  event(
    n,
    "move",
    `${p.name} ${m.kind === "enter" ? "released" : m.kind === "block" ? "moved a block of" : "moved"} counter${m.pieces.length > 1 ? "s" : ""} ${m.pieces.map((i) => i + 1).join(" + ")}${m.kind === "enter" ? "" : ` using ${m.dice.map((i) => g.dice![i]).join(" + ")}`}.`,
  );
  const resolvedCaptures = m.captures.filter(
    (c) => n.players[c.player].pieces[c.piece] === -1,
  );
  const landed = m.pieces.every(
    (i) => p.pieces[i] !== g.players[g.current].pieces[i],
  );
  if (resolvedCaptures.length) {
    p.captures += resolvedCaptures.length;
    event(
      n,
      "capture",
      n.war
        ? `${playerLabel(n, p.id)} cut ${resolvedCaptures.map((c) => counterLabel(n, n.players[c.player].id, c.piece)).join(" and ")}; returned to the Yard.`
        : `${p.name} captured ${resolvedCaptures.length} counter${resolvedCaptures.length === 1 ? "" : "s"}.`,
    );
  }
  if (m.formsBlock && landed) {
    p.blocks++;
    event(n, "block", `${p.name} formed a block.`);
  }
  if (landed && m.from <= 50 && m.to > 50)
    event(n, "home", `${p.name} entered the home lane.`);
  if (m.to === FINISH && landed) {
    p.finished += m.pieces.length;
    event(n, "finish", `${p.name} brought a counter home.`);
  }
  if (p.pieces.every((v) => v === FINISH)) {
    n.phase = "finished";
    n.winnerId = p.id;
    n.remaining = [];
    event(n, "win", `${p.name} wins! All four counters are home.`);
    return n;
  }
  if (!landed)
    recordEvent(
      n,
      "war",
      `Guard Up absorbed the cut against ${m.captures.map((c) => counterLabel(g, g.players[c.player].id, c.piece)).join(" and ")}. ${playerLabel(n, p.id)} stays put; the allocated dice are spent.`,
      "significant",
      "defence",
    );
  if (!legalMoves(n).length) endRoll(n);
  return n;
}
export function passGame(g: Game, actor: string): Game {
  checkActor(g, actor);
  if (g.phase !== "move" || g.rules.useBoth)
    throw Error("Use the legal dice before ending your roll.");
  const n = structuredClone(g);
  n.revision++;
  event(n, "move", `${currentPlayer(n).name} forfeited the remaining dice.`);
  endRoll(n);
  return n;
}
export function timeoutGame(g: Game): Game {
  if (g.phase === "finished") return g;
  const n = structuredClone(g);
  n.revision++;
  event(n, "timeout", `${currentPlayer(n).name} ran out of time.`);
  nextPlayer(n);
  return n;
}
export function forfeitGame(g: Game, id: string): Game {
  if (g.phase === "finished") return g;
  const index = g.players.findIndex((p) => p.id === id);
  if (index < 0 || g.players[index].forfeited) return g;
  const n = structuredClone(g);
  n.players[index].forfeited = true;
  if (n.war) {
    if (n.war.lock === id) {
      delete n.war.lock;
      recordEvent(
        n,
        "war",
        `Heaven Lock ended because ${playerLabel(n, id)} left. Heaven is open.`,
        "critical",
        "lock",
      );
    }
    n.war.effects = n.war.effects.filter((e) => e.owner !== id);
  }
  n.revision++;
  event(n, "forfeit", `${n.players[index].name} left the match.`);
  const remaining = n.players.filter((p) => !p.forfeited);
  if (remaining.length <= 1) {
    n.phase = "finished";
    n.winnerId = remaining[0]?.id;
    event(n, "win", `${remaining[0]?.name || "Nobody"} wins by forfeit.`);
  } else if (index === n.current) nextPlayer(n);
  return n;
}
export function chooseMove(g: Game): Move | undefined {
  const p = currentPlayer(g),
    permit = hasPermit(g, p);
  return legalMoves(g)
    .map((m) => {
      let score = m.to === FINISH ? 1000 : 0;
      score +=
        m.captures.length * 170 +
        (m.formsBlock ? 45 : 0) +
        (m.to > 50 ? 90 : 0) +
        (m.kind === "enter" ? 22 : 0) +
        (m.to - Math.max(0, m.from)) * 2;
      if (g.rules.blockBeforeHome && !permit) {
        score += m.to === 50 ? 200 : Math.max(0, m.to) * 0.5;
        if (m.to === 50 && p.pieces.some((v) => v === 50)) score += 250;
      }
      // Prefer safety, while still making progress. All candidates have already passed legality checks.
      if (m.to <= 50 && m.to >= 0) {
        const dest = cellId(p.colour, m.to);
        if (protectedCell(g, dest)) score += 30;
        for (const enemy of g.players.filter(
          (e) => !e.forfeited && e.id !== p.id,
        ))
          for (const pos of enemy.pieces)
            if (pos >= 0 && pos <= 50) {
              const gap =
                (Number(dest.slice(6)) -
                  Number(cellId(enemy.colour, pos).slice(6)) +
                  52) %
                52;
              if (gap > 0 && gap <= 6) score -= 10;
            }
      }
      return { m, score };
    })
    .sort((a, b) => b.score - a.score || a.m.id.localeCompare(b.m.id))[0]?.m;
}

export function directMove(
  g: Game,
  piece: number,
  distance: number,
): Move | undefined {
  if (
    !Number.isInteger(piece) ||
    piece < 0 ||
    piece > 3 ||
    !Number.isInteger(distance) ||
    distance < 1 ||
    distance > 3 ||
    currentPlayer(g).pieces[piece] < 0
  )
    return;
  const n = structuredClone(g);
  if (n.war)
    n.war.effects = n.war.effects.map((e) => ({ ...e, slow: undefined }));
  n.dice = [distance, 1];
  n.remaining = [0];
  n.phase = "move";
  const m = buildMove(n, [piece], [0], "move");
  if (
    !m ||
    m.to === FINISH ||
    m.captures.some(
      (c) =>
        effect(g, { owner: g.players[c.player].id, piece: c.piece })?.shield,
    )
  )
    return;
  return m;
}

export function directGroupMove(
  g: Game,
  pieces: number[],
  distance: number,
): Move | undefined {
  if (pieces.length === 1) return directMove(g, pieces[0], distance);
  if (
    !g.rules.moveBlocks ||
    !Number.isInteger(distance) ||
    distance < 1 ||
    distance > 2
  )
    return;
  const p = currentPlayer(g),
    from = p.pieces[pieces[0]];
  if (
    from < 0 ||
    from > 50 ||
    pieces.length < g.rules.blockSize ||
    pieces.some(
      (i) => !Number.isInteger(i) || i < 0 || i > 3 || p.pieces[i] !== from,
    ) ||
    p.pieces.filter((v) => v === from).length !== pieces.length
  )
    return;
  const n = structuredClone(g);
  if (n.war)
    n.war.effects = n.war.effects.map((e) => ({ ...e, slow: undefined }));
  n.dice = [distance, distance];
  n.remaining = [0, 1];
  n.phase = "move";
  const m = buildMove(n, pieces, [0, 1], "block");
  if (
    !m ||
    m.to === FINISH ||
    m.captures.some(
      (c) =>
        effect(g, { owner: g.players[c.player].id, piece: c.piece })?.shield,
    )
  )
    return;
  return m;
}
