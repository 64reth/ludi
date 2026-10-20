import { track, homes, yardCells } from "./geometry";
import { cellId, type Game } from "../game-engine/index";
export type Point = { x: number; y: number };
export function pointFor(cell: string): Point {
  if (cell.startsWith("finish-"))
    return [
      { x: 6.7, y: 7.5 },
      { x: 7.5, y: 6.7 },
      { x: 8.3, y: 7.5 },
      { x: 7.5, y: 8.3 },
    ][Number(cell.slice(7))];
  const c = [...track, ...homes, ...yardCells].find((c) => c.id === cell);
  if (!c) throw Error("Unknown board cell.");
  return {
    x: c.x + (c.kind === "yard" ? 0 : 0.5),
    y: c.y + (c.kind === "yard" ? 0 : 0.5),
  };
}
export type Token = {
  key: string;
  owner: string;
  colour: number;
  piece: number;
  progress: number;
  cell: string;
  x: number;
  y: number;
  size: number;
};
export function tokensFor(game?: Game, stack = false): Token[] {
  const raw = game
    ? game.players
        .filter((p) => !p.forfeited)
        .flatMap((p) =>
          p.pieces.map((progress, i) => ({
            key: `${p.id}-${i}`,
            owner: p.id,
            colour: p.colour,
            piece: i,
            progress,
            cell: cellId(p.colour, progress, i),
          })),
        )
    : yardCells.map((c, i) => ({
        key: c.id,
        owner: "",
        colour: c.colour!,
        piece: i % 4,
        progress: -1,
        cell: stack && i < 2 ? "track-44" : c.id,
      }));
  return raw.map((p) => {
    const same = raw.filter((o) => o.cell === p.cell),
      index = same.findIndex((o) => o.key === p.key);
    const center = pointFor(p.cell);
    const finished = p.progress === 56,
      crowded = same.length > 1;
    let { x, y } = center;
    if (crowded) {
      const s = finished ? 0.15 : 0.18;
      const offsets =
        same.length === 2
          ? [
              [-s, -s / 2],
              [s, s / 2],
            ]
          : [
              [-s, -s],
              [s, -s],
              [-s, s],
              [s, s],
            ];
      x += offsets[index][0];
      y += offsets[index][1];
    }
    return {
      ...p,
      x,
      y,
      size: finished ? 0.22 : crowded ? 0.34 : p.progress < 0 ? 0.53 : 0.43,
    };
  });
}
