import type { Game, GameEvent } from "./index";
export type EventTone = "ordinary" | "war" | "significant" | "critical";
export function recordEvent(
  g: Game,
  kind: GameEvent["kind"],
  text: string,
  tone: EventTone = "war",
  topic?: string,
) {
  const id = (g.eventSerial || 0) + 1;
  g.eventSerial = id;
  g.events = [
    ...g.events,
    { id, kind, text, tone, topic, round: g.war?.round },
  ].slice(-100);
}
export function playerLabel(g: Game, id: string) {
  const p = g.players.find((p) => p.id === id);
  return p
    ? `${p.name} (${["Red", "Green", "Gold", "Blue"][p.colour]})`
    : "Player";
}
export function counterLabel(g: Game, id: string, piece: number) {
  return `${playerLabel(g, id)} counter ${piece + 1}`;
}
