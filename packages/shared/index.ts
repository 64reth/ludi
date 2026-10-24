import type { Game } from "../game-engine/index";
import type { Rules } from "../rules/index";
export const colours = ["red", "green", "gold", "blue"] as const;
export type Player = {
  id: string;
  name: string;
  colour: (typeof colours)[number];
  ready: boolean;
  computer: boolean;
  connected: boolean;
};
export type Room = {
  id: string;
  code: string;
  hostId: string;
  rules: Rules;
  players: Player[];
  started: boolean;
  revision: number;
  game?: Game;
  deadline?: number;
  rematchReady?: string[];
  expiresAt?: number;
};
export type Command =
  | { type: "ping" }
  | { type: "create"; name: string; rules: Rules; operationId?: string }
  | { type: "join"; name: string; code: string; operationId?: string }
  | { type: "resume"; code: string; token: string }
  | { type: "ready"; ready: boolean }
  | { type: "rules"; rules: Rules }
  | { type: "start" }
  | { type: "leave" }
  | { type: "roll"; revision: number; match: number }
  | { type: "move"; moveId: string; revision: number; match: number }
  | { type: "skill"; actionId: string; revision: number; match: number }
  | { type: "pass"; revision: number; match: number }
  | { type: "rematch" }
  | { type: "lobby" };
export type Reply =
  | { type: "pong" }
  | { type: "state"; room: Room; playerId: string; token?: string }
  | { type: "error"; message: string; reason?: "unavailable" | "credentials" | "occupied" }
  | { type: "left" };
