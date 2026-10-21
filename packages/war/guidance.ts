import { cellId, currentPlayer, type Game } from "../game-engine/index";
import { gates } from "../board/geometry";
import {
  cost,
  purchaseReason,
  effect,
  legalSkills,
  skills,
  trackDistance,
  type Ref,
  type Skill,
} from "./index";
export const sameRef = (a: Ref | undefined, b: Ref | undefined) =>
  !!a && !!b && a.owner === b.owner && a.piece === b.piece;
export function windowReason(g: Game) {
  if (!g.war) return "";
  return g.war.window
    ? "Prepare or deploy a skill, or roll your dice. Prepared skills can be held for later turns."
    : g.war.lastSkill?.turn === g.turn
      ? "Skill used this normal turn. Your next opportunity follows the full table rotation."
      : "Rolling closed the skill window. Bonus rolls keep it closed; wait for your next normal turn.";
}
export function unavailable(g: Game, s: Skill) {
  const w = g.war!,
    p = currentPlayer(g);
  if (!w.window) return windowReason(g);
  if (!w.prepared?.[p.id]) return purchaseReason(g, s);
  if (w.prepared[p.id] !== s) return "Another skill occupies your prepared slot.";
  const c = 0;
  if (w.bank[p.id] < c)
    return `Need ${c - w.bank[p.id]} more points (${c} required).`;
  if (s === "lock" && w.lock)
    return "Heaven is already sealed. A lock cannot be refreshed or stacked.";
  if (!legalSkills(g).some((a) => a.skill === s))
    return s === "guard"
      ? "No unshielded active counters. Counters in the Yard or Heaven cannot be selected."
      : s === "tempo"
        ? "No legal advance or unslowed opposing track counter. Shields can absorb Draw Back."
        : "No exposed targets in range. Yards, home lanes, protected territory, shields and stacks are excluded.";
  return "";
}
export function rangeHelp(s: Skill) {
  return {
    guard:
      "Choose one of your active, unshielded counters. Protection ends at your next normal turn if unused.",
    tempo:
      "Fast Forward: choose your counter, then 1–3 legal spaces. Draw Back: choose an opposing shared-track counter. No range limit for Draw Back; shields absorb it.",
    switch:
      "Choose your exposed counter and one exposed opponent within 6 connected shared-track spaces. No protected squares, stacks, Yard, home lanes or Heaven.",
    long: "Choose your track counter, then one exposed opponent within 4 connected track spaces. No safe squares, shields or stacks.",
    double:
      "Choose your track counter, then 1 or 2 exposed opponents within 3 connected track spaces. One target costs the same 12-point base price.",
    lock: "No counter selection needed. All players, including you, are prevented from finishing until your next normal turn.",
  }[s];
}
export function invalidTarget(g: Game, s: Skill, r: Ref, source?: Ref) {
  const p = g.players.find((p) => p.id === r.owner)!;
  const v = p.pieces[r.piece];
  if (v < 0)
    return "That counter is in the Yard. Choose a highlighted active counter.";
  if (
    v > 50 &&
    s !== "guard" &&
    !(s === "tempo" && r.owner === currentPlayer(g).id)
  )
    return "Home lanes and Heaven are outside this skill’s targets.";
  if (v === 56) return "That counter has already reached Heaven.";
  if (effect(g, r)?.shield && s !== "tempo")
    return "Guard Up protects this counter; choose a different target.";
  if (source && r.owner === source.owner)
    return "Choose an opposing counter for this target.";
  if (source && v <= 50) {
    const owner = g.players.find((p) => p.id === source.owner)!;
    const a = Number(cellId(owner.colour, owner.pieces[source.piece]).slice(6)),
      b = Number(cellId(p.colour, v).slice(6)),
      range = s === "switch" ? 6 : s === "long" ? 4 : 3;
    if (trackDistance(a, b) > range)
      return `Out of range: this skill reaches ${range} connected track spaces in either direction.`;
  }
  if (v <= 50) {
    const cell = Number(cellId(p.colour, v).slice(6));
    if (
      (g.rules.safeSquares && [8, 21, 34, 47].includes(cell)) ||
      (g.rules.protectedGates && gates.includes(cell))
    )
      return "This square is protected from this skill.";
    if (p.pieces.filter((n) => n === v).length > 1)
      return "This stack cannot be selected by this skill.";
  }
  return "That counter is not a legal choice for this step. Use a highlighted counter.";
}
export function abilityDescription(s: Skill) {
  return `${skills[s].help} ${rangeHelp(s)} Each purchase raises this skill’s next price by 3, up to 12. Fast Forward and Draw Back share one price.`;
}
