export type Cell = {
  id: string;
  x: number;
  y: number;
  kind: "track" | "home" | "finish" | "yard";
  colour?: number;
};
// Clockwise perimeter of the 15 × 15 cross. Track indices are stable, never inferred by rendering.
const coords: number[][] = [
  [6, 0],
  [7, 0],
  [8, 0],
  [8, 1],
  [8, 2],
  [8, 3],
  [8, 4],
  [8, 5],
  [9, 6],
  [10, 6],
  [11, 6],
  [12, 6],
  [13, 6],
  [14, 6],
  [14, 7],
  [14, 8],
  [13, 8],
  [12, 8],
  [11, 8],
  [10, 8],
  [9, 8],
  [8, 9],
  [8, 10],
  [8, 11],
  [8, 12],
  [8, 13],
  [8, 14],
  [7, 14],
  [6, 14],
  [6, 13],
  [6, 12],
  [6, 11],
  [6, 10],
  [6, 9],
  [5, 8],
  [4, 8],
  [3, 8],
  [2, 8],
  [1, 8],
  [0, 8],
  [0, 7],
  [0, 6],
  [1, 6],
  [2, 6],
  [3, 6],
  [4, 6],
  [5, 6],
  [6, 5],
  [6, 4],
  [6, 3],
  [6, 2],
  [6, 1],
];
export const gates = [42, 3, 16, 29];
export const yards = [
  { x: 0, y: 0 },
  { x: 9, y: 0 },
  { x: 9, y: 9 },
  { x: 0, y: 9 },
];
export const track: Cell[] = coords.map(([x, y], i) => ({
  id: `track-${i}`,
  x,
  y,
  kind: "track",
  colour: gates.includes(i) ? gates.indexOf(i) : undefined,
}));
export const homes: Cell[] = Array.from({ length: 4 }, (_, c) =>
  Array.from({ length: 5 }, (_, i) => ({
    id: `home-${c}-${i}`,
    x: c === 0 ? i + 1 : c === 2 ? 13 - i : 7,
    y: c === 1 ? i + 1 : c === 3 ? 13 - i : 7,
    kind: "home" as const,
    colour: c,
  })),
).flat();
export const yardCells: Cell[] = yards.flatMap((p, c) =>
  Array.from({ length: 4 }, (_, i) => ({
    id: `yard-${c}-${i}`,
    x: p.x + 1.7 + (i % 2) * 2.5,
    y: p.y + 1.7 + Math.floor(i / 2) * 2.5,
    kind: "yard",
    colour: c,
  })),
);
export const finishes: Cell[] = Array.from({ length: 4 }, (_, c) => ({
  id: `finish-${c}`,
  x: 7,
  y: 7,
  kind: "finish",
  colour: c,
}));
