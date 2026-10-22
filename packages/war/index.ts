import { recordEvent, playerLabel, counterLabel } from "../game-engine/events";
import {
  cellId,
  currentPlayer,
  directMove,
  blockJump,
  directGroupMove,
  type Game,
  type Move,
} from "../game-engine/index";
import { gates } from "../board/geometry";
export const skills = {
  guard: {
    name: "Guard Up",
    base: 3,
    help: "Shield one counter until your next normal turn.",
  },
  tempo: {
    name: "Fast Forward / Draw Back",
    base: 6,
    help: "Advance up to 3 legal spaces, or slow an opponent’s next move by up to 3.",
  },
  switch: {
    name: "Switcheroo",
    base: 6,
    help: "Exchange exposed counters within 6 track spaces.",
  },
  long: {
    name: "Long Cut",
    base: 9,
    help: "Cut one exposed opponent within 4 track spaces.",
  },
  jump: {
    name: "Block Jumper",
    base: 9,
    help: "Leap one counter over the nearest opposing blockade within 6 track spaces, landing on the empty square immediately beyond it.",
  },
  double: {
    name: "Double Cut",
    base: 12,
    help: "Cut up to two exposed opponents within 3 track spaces.",
  },
  lock: {
    name: "Heaven Lock",
    base: 12,
    help: "Seal Heaven for everyone until your next normal turn.",
  },
} as const;
export type Skill = keyof typeof skills;
export type Ref = { owner: string; piece: number };
export type Effect = Ref & { shield?: boolean; slow?: number; danger?: number };
export type Hazard = { cell: number; kind: "slip" | "sand" | "danger" };
export type War = {
  version: 1;
  round: number;
  prepared?: Record<string, Skill>;
  purchasedThisWindow?: boolean;
  completed: string[];
  window: boolean;
  bank: Record<string, number>;
  purchases: Record<string, Partial<Record<Skill, number>>>;
  effects: Effect[];
  lock?: string;
  active: Hazard[];
  incoming: Hazard[];
  activates: number;
  feedback: string;
  lastSkill?: { revision: number; turn?: number; skill: Skill; refs: Ref[] };
};
export type SkillAction = {
  id: string;
  skill: Skill;
  cost: number;
  source?: Ref;
  targets: Ref[];
  to?: number;
  mode?: "forward" | "back";
  label: string;
};
const eligible = Array.from({ length: 52 }, (_, i) => i).filter(
  (i) => ![...gates, ...gates.map((v) => (v + 50) % 52)].includes(i),
);
function forecast(cycle: number): Hazard[] {
  return [0, 1].map((_, i) => ({
    cell: eligible[(cycle * 7 + i * 13) % eligible.length],
    kind: (["slip", "sand", "danger"] as const)[(cycle + i) % 3],
  }));
}
export function createWar(g: Game): War {
  return {
    version: 1,
    round: 1,
    prepared: {},
    purchasedThisWindow: false,
    completed: [],
    window: true,
    bank: Object.fromEntries(g.players.map((p) => [p.id, 0])),
    purchases: Object.fromEntries(g.players.map((p) => [p.id, {}])),
    effects: [],
    active: [],
    incoming: forecast(0),
    activates: 2,
    feedback: "War Bank starts empty. Roll to earn power.",
  };
}
export function cost(g: Game, s: Skill) {
  const w = g.war!;
  return Math.min(
    12,
    skills[s].base + 3 * (w.purchases[currentPlayer(g).id][s] || 0),
  );
}
export function effect(g: Game, r: Ref) {
  return g.war?.effects.find((e) => e.owner === r.owner && e.piece === r.piece);
}
function setEffect(g: Game, r: Ref) {
  let e = effect(g, r);
  if (!e) {
    e = { ...r };
    g.war!.effects.push(e);
  }
  return e;
}
export function warTurn(g: Game, ended: string) {
  const w = g.war;
  if (!w) return;
  w.completed = [...new Set([...w.completed, ended])];
  const active = g.players.filter((p) => !p.forfeited);
  if (active.every((p) => w.completed.includes(p.id))) {
    w.round++;
    w.completed = [];
    if (w.round === w.activates) {
      if (w.active.length)
        recordEvent(
          g,
          "war",
          "Previous battlefield hazards expired. Their symbols are no longer active.",
          "war",
          "hazard",
        );
      w.active = w.incoming;
      recordEvent(
        g,
        "war",
        `Round ${w.round}: ${w.active.map((h) => hazardName(h.kind)).join(" and ")} are now active at the solid markers. Only new landings trigger them.`,
        "war",
        "hazard",
      );
      w.effects = w.effects.map((e) => ({ ...e, danger: undefined }));
      w.incoming = [];
      w.activates += 2;
    }
    if (w.round === w.activates - 1) {
      w.incoming = forecast(Math.floor(w.activates / 2) - 1);
      recordEvent(
        g,
        "war",
        `Incoming for round ${w.activates}: ${w.incoming.map((h) => hazardName(h.kind)).join(" and ")}. Dashed markers warn one full round ahead; they have no effect yet.`,
        "war",
        "hazard",
      );
    }
  }
  const id = currentPlayer(g).id;
  w.window = true;
  w.purchasedThisWindow = false;
  for (const e of w.effects.filter((e) => e.owner === id && e.shield))
    recordEvent(
      g,
      "war",
      `${counterLabel(g, id, e.piece)}: unused Guard Up expired at the start of this normal turn.`,
      "war",
      "defence",
    );
  w.effects = w.effects.map((e) =>
    e.owner === id ? { ...e, shield: false } : e,
  );
  if (w.lock === id) {
    delete w.lock;
    recordEvent(
      g,
      "war",
      `Heaven Lock expired at ${playerLabel(g, id)}’s normal turn. Heaven is open to everyone again.`,
      "critical",
      "lock",
    );
  }
  recordEvent(
    g,
    "war",
    `${playerLabel(g, id)}: skill window open · bank ${w.bank[id]}/12. Prepare or deploy one skill, or roll; bonus rolls never reopen it.`,
    "war",
    "window",
  );
}
export function warRoll(g: Game, dice: [number, number]) {
  const w = g.war;
  if (!w) return;
  const id = currentPlayer(g).id,
    sum = dice[0] + dice[1],
    earned = Math.ceil(sum * 0.5),
    gain = Math.min(12 - w.bank[id], earned),
    overflow = earned - gain;
  w.bank[id] += gain;
  if (w.window)
    recordEvent(
      g,
      "war",
      `${playerLabel(g, id)} rolled: skill window closed until their next normal turn.`,
      "war",
      "window",
    );
  w.window = false;
  w.feedback = `${playerLabel(g, id)}: +${gain} power${overflow ? ` · ${overflow} overflow lost` : ""}. Bank ${w.bank[id]}/12.`;
  recordEvent(g, "war", w.feedback, "war", "bank");
}
export function penalty(g: Game, pieces: number[]) {
  return Math.max(
    0,
    ...pieces.map(
      (piece) => effect(g, { owner: currentPlayer(g).id, piece })?.slow || 0,
    ),
  );
}
export function dangerous(g: Game, cell: string) {
  const n = Number(cell.slice(6));
  return (
    g.war?.effects.some((e) => {
      const p = g.players.find((p) => p.id === e.owner);
      return (
        e.danger === n &&
        p &&
        !p.forfeited &&
        cellId(p.colour, p.pieces[e.piece]) === cell
      );
    }) || false
  );
}
function track(g: Game, r: Ref) {
  const p = g.players.find((p) => p.id === r.owner)!;
  const v = p.pieces[r.piece];
  return v >= 0 && v <= 50 ? Number(cellId(p.colour, v).slice(6)) : -1;
}
export function trackDistance(a: number, b: number) {
  return Math.min((a - b + 52) % 52, (b - a + 52) % 52);
}
function protectedAt(g: Game, n: number) {
  return (
    (g.rules.safeSquares && [8, 21, 34, 47].includes(n)) ||
    (g.rules.protectedGates && gates.includes(n))
  );
}
function exposed(g: Game, r: Ref) {
  const n = track(g, r);
  return (
    n >= 0 &&
    !effect(g, r)?.shield &&
    !protectedAt(g, n) &&
    g.players
      .filter((p) => !p.forfeited)
      .flatMap((p) =>
        p.pieces.filter(
          (v) =>
            v >= 0 && v <= 50 && Number(cellId(p.colour, v).slice(6)) === n,
        ),
      ).length === 1
  );
}
export function skillTargets(g: Game): SkillAction[] {
  const w = g.war;
  if (!w || !w.window || g.phase !== "roll" || currentPlayer(g).forfeited)
    return [];
  const p = currentPlayer(g),
    out: SkillAction[] = [];
  const add = (
    skill: Skill,
    label: string,
    source: Ref | undefined,
    targets: Ref[] = [],
    to?: number,
    mode?: "forward" | "back",
  ) => {
    const held = w.prepared?.[p.id];
    if (held && held !== skill) return;
    const c = held ? 0 : cost(g, skill);
    if (!held && w.bank[p.id] < c) return;
    out.push({
      id: `${g.match}:${g.revision}:skill:${out.length}`,
      skill,
      cost: c,
      source,
      targets,
      to,
      mode,
      label,
    });
  };
  const own = p.pieces.flatMap((v, piece) =>
    v >= 0 && v < 56 ? [{ owner: p.id, piece }] : [],
  );
  const enemies = g.players
    .filter((e) => e.id !== p.id && !e.forfeited)
    .flatMap((e) =>
      e.pieces.flatMap((v, piece) =>
        v >= 0 && v <= 50 ? [{ owner: e.id, piece }] : [],
      ),
    );
  const name = (r: Ref) =>
    `${g.players.find((p) => p.id === r.owner)!.name} counter ${r.piece + 1}`;
  for (const s of own) {
    if (!effect(g, s)?.shield) add("guard", `Guard counter ${s.piece + 1}`, s);
    for (let d = 1; d <= 3; d++) {
      const m = directMove(g, s.piece, d);
      if (m && m.to < 56)
        add(
          "tempo",
          `Fast Forward counter ${s.piece + 1} · ${d} ${d === 1 ? "space" : "spaces"}`,
          s,
          [],
          m.to,
          "forward",
        );
    }
    const leap = blockJump(g, s.piece);
    if (leap) add("jump", `Counter ${s.piece + 1}: jump blockade · advance ${leap.to - leap.from} spaces`, s, [], leap.to);
    const n = track(g, s);
    if (n < 0) continue;
    const nearby = enemies.filter((t) => exposed(g, t));
    for (const t of nearby) {
      const distance = trackDistance(n, track(g, t));
      if (distance <= 6 && exposed(g, s) && swapLegal(g, s, t))
        add("switch", `Switch counter ${s.piece + 1} with ${name(t)}`, s, [t]);
      if (distance <= 4)
        add("long", `Counter ${s.piece + 1}: Cut ${name(t)}`, s, [t]);
    }
    const double = nearby.filter((t) => trackDistance(n, track(g, t)) <= 3);
    for (let i = 0; i < double.length; i++) {
      add(
        "double",
        `Counter ${s.piece + 1}: Double Cut · ${double.length === 1 ? "only 1 target" : "single target"}: ${name(double[i])}`,
        s,
        [double[i]],
      );
      for (let j = i + 1; j < double.length; j++)
        add(
          "double",
          `Counter ${s.piece + 1}: Cut ${name(double[i])} + ${name(double[j])}`,
          s,
          [double[i], double[j]],
        );
    }
  }
  for (const t of enemies.filter(
    (t) => !protectedAt(g, track(g, t)) && !effect(g, t)?.slow,
  ))
    add(
      "tempo",
      `Draw Back ${name(t)} · next move up to 3 shorter${effect(g, t)?.shield ? " · shield absorbs it" : ""}`,
      undefined,
      [t],
      undefined,
      "back",
    );
  if (!w.lock)
    add(
      "lock",
      "Seal Heaven for everyone until your next normal turn",
      undefined,
    );
  return out;
}
export function legalSkills(g: Game): SkillAction[] {
  if (!g.war?.prepared?.[currentPlayer(g).id]) return [];
  return skillTargets(g);
}
export function purchaseReason(g: Game, skill: Skill): string {
  const w = g.war, p = currentPlayer(g);
  if (!w || !w.window || g.phase !== "roll" || p.forfeited) return "Wait for your next preparation window.";
  if (w.prepared?.[p.id]) return "Your prepared slot is occupied.";
  if (w.purchasedThisWindow) return "You already purchased in this preparation window.";
  if (!Object.hasOwn(skills, skill)) return "Unknown skill.";
  const price = cost(g, skill);
  return w.bank[p.id] < price ? `Need ${price - w.bank[p.id]} more points (${price} required).` : "";
}
export function purchaseSkill(g: Game, actor: string, skill: Skill): Game {
  if (currentPlayer(g).id !== actor) throw Error("Wait for your preparation window.");
  const reason = purchaseReason(g, skill);
  if (reason) throw Error(reason);
  const n = structuredClone(g), w = n.war!, price = cost(g, skill);
  w.bank[actor] -= price;
  w.purchases[actor][skill] = (w.purchases[actor][skill] || 0) + 1;
  (w.prepared ??= {})[actor] = skill;
  w.purchasedThisWindow = true;
  n.revision++;
  w.feedback = `${playerLabel(n, actor)} prepared ${skills[skill].name}. Spent ${price} · bank ${w.bank[actor]}/12. Hold it or deploy before rolling.`;
  recordEvent(n, "war", w.feedback, "war", "skill");
  return n;
}
export const skillIcons: Record<Skill, string> = { guard: "◇", tempo: "↔", switch: "⇄", long: "⚔", jump: "↷", double: "⚔⚔", lock: "▣" };
function swapLegal(g: Game, a: Ref, b: Ref) {
  const p = g.players.find((p) => p.id === a.owner)!,
    q = g.players.find((p) => p.id === b.owner)!;
  return (
    (track(g, b) - gates[p.colour] + 52) % 52 <= 50 &&
    (track(g, a) - gates[q.colour] + 52) % 52 <= 50
  );
}
export function useSkill(g: Game, actor: string, id: string): Game {
  if (id.startsWith("purchase:")) return purchaseSkill(g, actor, id.slice(9) as Skill);
  if (currentPlayer(g).id !== actor || g.phase === "finished")
    throw Error("Wait for your skill window.");
  const a = legalSkills(g).find((a) => a.id === id);
  if (!a) throw Error("That skill or target is no longer available.");
  const n = structuredClone(g),
    w = n.war!,
    p = currentPlayer(n);
  delete w.prepared![p.id];
  w.window = false;
  n.revision++;
  const previousFeedback = w.feedback;
  w.lastSkill = {
    revision: n.revision,
    turn: n.turn,
    skill: a.skill,
    refs: [...(a.source ? [a.source] : []), ...a.targets],
  };
  if (a.skill === "guard") setEffect(n, a.source!).shield = true;
  else if (a.skill === "jump") {
    const m = blockJump(n, a.source!.piece)!;
    applyDirect(n, m);
    afterMove(n, m, false);
  }
  else if (a.skill === "tempo" && a.mode === "back") {
    const e = setEffect(n, a.targets[0]);
    if (e.shield) {
      e.shield = false;
      recordEvent(
        n,
        "war",
        `${counterLabel(n, e.owner, e.piece)}: Guard Up absorbed Draw Back; no slow was applied.`,
        "significant",
        "defence",
      );
    } else e.slow = 3;
  } else if (a.skill === "tempo") {
    const m = directMove(
      n,
      a.source!.piece,
      a.to! - p.pieces[a.source!.piece],
    )!;
    applyDirect(n, m);
    afterMove(n, m);
  } else if (a.skill === "switch") {
    const s = a.source!,
      t = a.targets[0],
      q = n.players.find((p) => p.id === t.owner)!,
      aCell = track(n, s),
      bCell = track(n, t);
    p.pieces[s.piece] = (bCell - gates[p.colour] + 52) % 52;
    q.pieces[t.piece] = (aCell - gates[q.colour] + 52) % 52;
    clearDanger(n, s);
    clearDanger(n, t);
    const original = n.current;
    for (const ref of [s, t]) {
      n.current = n.players.findIndex((r) => r.id === ref.owner);
      const position = currentPlayer(n).pieces[ref.piece];
      if (position >= 0 && position <= 50)
        afterMove(
          n,
          {
            id: "",
            playerId: ref.owner,
            pieces: [ref.piece],
            dice: [],
            from: position,
            to: position,
            kind: "move",
            captures: [],
            formsBlock: false,
          },
          false,
        );
    }
    n.current = original;
  } else if (a.skill === "long" || a.skill === "double") {
    for (const t of a.targets) {
      n.players.find((p) => p.id === t.owner)!.pieces[t.piece] = -1;
      n.war!.effects = n.war!.effects.filter(
        (e) => !(e.owner === t.owner && e.piece === t.piece),
      );
    }
    p.captures += a.targets.length;
  } else w.lock = p.id;
  const detail =
    a.skill === "guard"
      ? `${counterLabel(n, a.source!.owner, a.source!.piece)} is shielded against the next eligible cut or hostile effect, until their next normal turn.`
      : a.skill === "jump"
        ? `${counterLabel(n, p.id, a.source!.piece)} leapt the blockade without cutting or entering home.`
      : a.skill === "long" || a.skill === "double"
        ? `${a.targets.map((t) => counterLabel(n, t.owner, t.piece)).join(" and ")} sent to the Yard.`
        : a.skill === "switch"
          ? `${counterLabel(n, a.source!.owner, a.source!.piece)} and ${counterLabel(n, a.targets[0].owner, a.targets[0].piece)} exchanged positions.`
          : a.skill === "lock"
            ? "Heaven is sealed for everyone, including the caster, until the caster’s next normal turn."
            : a.mode === "back"
              ? `${counterLabel(n, a.targets[0].owner, a.targets[0].piece)}: next eligible movement up to 3 shorter unless a shield absorbed it; at least 1 space remains.`
              : `${counterLabel(n, a.source!.owner, a.source!.piece)} advanced along its legal route.`;
  w.feedback = `${playerLabel(n, p.id)} used ${skills[a.skill].name}: ${a.label}. ${detail}${w.feedback !== previousFeedback ? ` ${w.feedback}` : ""} Prepared slot cleared · bank ${w.bank[p.id]}/12.`;
  recordEvent(
    n,
    "war",
    w.feedback,
    a.skill === "lock" ? "critical" : "significant",
    a.skill === "lock" ? "lock" : "skill",
  );
  return n;
}
function clearDanger(g: Game, r: Ref) {
  const e = effect(g, r);
  if (e) delete e.danger;
}
export function applyDirect(g: Game, m: Move) {
  const p = currentPlayer(g);
  for (const piece of m.pieces) {
    p.pieces[piece] = m.to;
    clearDanger(g, { owner: p.id, piece });
  }
  for (const c of m.captures) {
    const q = g.players[c.player];
    q.pieces[c.piece] = -1;
    g.war!.effects = g.war!.effects.filter(
      (e) => e.owner !== q.id || e.piece !== c.piece,
    );
  }
  p.captures += m.captures.length;
  if (m.formsBlock) p.blocks++;
  if (p.pieces.filter((v) => v === 50).length >= g.rules.blockSize)
    p.homeUnlocked = true;
}
export function afterMove(g: Game, m: Move, consumeSlow = true) {
  if (!g.war) return;
  const p = currentPlayer(g);
  for (const piece of m.pieces) {
    const e = effect(g, { owner: p.id, piece });
    if (e) {
      if (consumeSlow && e.slow && g.phase === "move" && m.from >= 0) {
        const nominal =
          m.kind === "block"
            ? g.dice![m.dice[0]]
            : m.dice.reduce((sum, i) => sum + g.dice![i], 0);
        const lost = Math.max(0, nominal - (m.to - m.from));
        recordEvent(
          g,
          "war",
          `${counterLabel(g, p.id, piece)}: movement penalty used · ${lost} fewer spaces this move (at least 1 space). The slow is now gone.`,
          "war",
          "slow",
        );
      }
      if (consumeSlow) delete e.slow;
      delete e.danger;
    }
  }
  for (const c of m.captures) {
    const q = g.players[c.player];
    g.war.effects = g.war.effects.filter(
      (e) => e.owner !== q.id || e.piece !== c.piece,
    );
  }
  const tile = g.war.active.find(
    (h) => `track-${h.cell}` === cellId(p.colour, m.to),
  );
  if (!tile) return;
  for (const piece of m.pieces) {
    const r = { owner: p.id, piece };
    if (tile.kind === "sand") setEffect(g, r).slow = 2;
    if (tile.kind === "danger") setEffect(g, r).danger = tile.cell;
  }
  let pushed = 0;
  if (tile.kind === "slip") {
    for (let d = 2; d >= 1; d--) {
      const extra = directGroupMove(g, m.pieces, d);
      if (extra && extra.to < 56) {
        applyDirect(g, extra);
        pushed = extra.to - m.to;
        break;
      }
    }
  }
  const result =
    tile.kind === "slip"
      ? pushed
        ? `advanced ${pushed} extra legal spaces.`
        : "no extra movement: the route or landing is blocked."
      : tile.kind === "sand"
        ? "next eligible move up to 2 shorter, then the penalty expires; at least 1 space remains."
        : "ordinary capture protection is removed while on this tile; purchased Guard Up still protects.";
  g.war.feedback = `${m.pieces.map((i) => counterLabel(g, p.id, i)).join(" and ")} landed on ${hazardName(tile.kind)}: ${result}`;
  recordEvent(g, "war", g.war.feedback, "war", "hazard");
}
export function hazardName(k: Hazard["kind"]) {
  return { slip: "Slipstream", sand: "Quicksand", danger: "Danger Tile" }[k];
}
export function chooseSkill(g: Game): SkillAction | undefined {
  if (!g.war) return;
  const p = currentPlayer(g),
    actions = g.war.prepared?.[p.id] ? legalSkills(g) : g.war.purchasedThisWindow ? [] : skillTargets(g);
  const ranked = actions
    .map((a) => ({
      a,
      score:
        a.skill === "double"
          ? 220 * a.targets.length
          : a.skill === "long"
            ? 200
            : a.skill === "jump"
              ? 120 + (a.to! - p.pieces[a.source!.piece])
            : a.skill === "switch"
              ? 40 + 12 * ((track(g, a.targets[0]) - gates[p.colour] + 52) % 52 - p.pieces[a.source!.piece])
              : a.skill === "tempo" && a.mode === "forward"
                ? 30 + (a.to || 0)
                : a.skill === "guard"
                  ? 25
                  : a.skill === "lock" &&
                      g.players.some(
                        (q) =>
                          q.id !== p.id &&
                          q.pieces.some((v) => v >= 52 && v < 56),
                      )
                    ? 110
                    : 0,
    }))
    .sort((a, b) => b.score - a.score || a.a.id.localeCompare(b.a.id));
  const best = ranked[0];
  return best &&
    (best.score >= 100 || (g.war.prepared?.[p.id] && best.score > 0) || (g.war.bank[p.id] >= 10 && best.score > 0))
    ? g.war.prepared?.[p.id] ? best.a : { ...best.a, id: `purchase:${best.a.skill}` }
    : undefined;
}
