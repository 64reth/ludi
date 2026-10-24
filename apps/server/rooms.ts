import { useSkill, chooseSkill } from "../../packages/war/index";
import { randomBytes, randomUUID, randomInt } from "node:crypto";
import type { WebSocket, WebSocketServer } from "ws";
import { validate } from "../../packages/rules/index";
import {
  colours,
  type Room,
  type Command,
  type Reply,
} from "../../packages/shared/index";
import {
  createGame,
  currentPlayer,
  rollGame,
  moveGame,
  passGame,
  timeoutGame,
  forfeitGame,
  chooseMove,
  type Game,
} from "../../packages/game-engine/index";
type Member = {
  room: Room;
  id: string;
  token: string;
  operationId?: string;
  socket?: WebSocket;
  timer?: ReturnType<typeof setTimeout>;
};
export type RoomSnapshot = { retiredOperations?: string[]; rooms: Room[]; members: { code: string; id: string; token: string; operationId?: string }[] };
type Options = {
  rollDice?: () => [number, number]; botDelay?: number;
  roomCode?: string; snapshot?: RoomSnapshot;
  persist?: (snapshot: RoomSnapshot) => void;
  recoveryMs?: number;
};
export function attachRooms(wss: WebSocketServer, options: Options = {}) {
  const retiredOperations = new Set(options.snapshot?.retiredOperations ?? []);
  function retire(operationId?: string) {
    if (operationId) retiredOperations.add(operationId);
  }
  const rooms = new Map<string, Room>(),
    members = new Map<string, Member>(),
    botTimers = new Map<Room, ReturnType<typeof setTimeout>>(),
    turnTimers = new Map<Room, ReturnType<typeof setTimeout>>();
  const dice =
    options.rollDice ??
    (() => [randomInt(1, 7), randomInt(1, 7)] as [number, number]);
  const send = (ws: WebSocket, data: Reply) => {
    if (ws.readyState === 1) ws.send(JSON.stringify(data));
  };
  function clearRoom(r: Room) {
    clearTimeout(botTimers.get(r));
    clearTimeout(turnTimers.get(r));
    botTimers.delete(r);
    turnTimers.delete(r);
    rooms.delete(r.code);
    for (const [token, m] of members) if (m.room === r) { clearTimeout(m.timer); retire(m.operationId); members.delete(token); }
    persist();
  }
  function setGame(r: Room, g: Game) {
    const old = r.game;
    r.game = g;
    if (g.phase === "finished") {
      delete r.deadline;
      clearTimeout(turnTimers.get(r));
      turnTimers.delete(r);
    } else if (!old || old.turn !== g.turn || old.match !== g.match) {
      clearTimeout(turnTimers.get(r));
      delete r.deadline;
      if (r.rules.timer) {
        r.deadline = Date.now() + r.rules.timer * 1000;
        const t = setTimeout(() => {
          if (!rooms.has(r.code) || !r.game || r.game.phase === "finished")
            return;
          setGame(r, timeoutGame(r.game));
          publish(r);
        }, r.rules.timer * 1000);
        t.unref?.();
        turnTimers.set(r, t);
      }
    }
  }
  function persist() {
    options.persist?.({ retiredOperations: [...retiredOperations], rooms: [...rooms.values()], members: [...members.values()].map(m => ({ code: m.room.code, id: m.id, token: m.token, operationId: m.operationId })) });
  }
  function publish(r: Room) {
    r.revision++;
    persist();
    for (const m of members.values())
      if (m.room === r && m.socket)
        send(m.socket, { type: "state", room: r, playerId: m.id });
    clearTimeout(botTimers.get(r));
    botTimers.delete(r);
    if (
      !r.game ||
      r.game.phase === "finished" ||
      !currentPlayer(r.game).computer
    )
      return;
    const expected = r.game.revision,
      match = r.game.match;
    const timer = setTimeout(() => {
      if (
        !rooms.has(r.code) ||
        !r.game ||
        r.game.revision !== expected ||
        r.game.match !== match
      )
        return;
      const g = r.game,
        p = currentPlayer(g);
      const skill = chooseSkill(g);
      const next = skill
        ? useSkill(g, p.id, skill.id)
        : g.phase === "roll"
          ? rollGame(g, p.id, dice())
          : moveGame(g, p.id, chooseMove(g)!.id);
      setGame(r, next);
      publish(r);
    }, options.botDelay ?? 550);
    timer.unref?.();
    botTimers.set(r, timer);
  }
  function setup(r: Room, match = 1) {
    const seats = [...r.players]
      .sort((a, b) => colours.indexOf(a.colour) - colours.indexOf(b.colour))
      .map((p) => ({
        id: p.id,
        name: p.name,
        colour: colours.indexOf(p.colour),
        computer: p.computer,
      }));
    setGame(r, createGame(r.rules, seats, match));
    r.started = true;
    r.rematchReady = [];
  }
  function remove(m: Member) {
    clearTimeout(m.timer);
    retire(m.operationId);
    members.delete(m.token);
    const r = m.room;
    if (r.game) setGame(r, forfeitGame(r.game, m.id));
    r.players = r.players.filter((p) => p.id !== m.id);
    const humans = r.players.filter((p) => !p.computer);
    if (!humans.length) {
      clearRoom(r);
      return;
    }
    if (r.hostId === m.id) r.hostId = humans[0].id;
    reserve(r);
    publish(r);
  }
  function syncBots(r: Room) {
    r.players = r.players.filter((p) => !p.computer);
    for (let i = 0; i < r.rules.players; i++)
      if (r.rules.slots[i] === "computer")
        r.players.push({
          id: randomUUID(),
          name: `Computer ${i + 1}`,
          colour: colours[i],
          ready: true,
          computer: true,
          connected: true,
        });
  }
  const recoveryMs = options.recoveryMs ?? 30 * 60_000;
  function expire() {
    for (const r of rooms.values())
      if (r.expiresAt && r.expiresAt <= Date.now() && !r.players.some(p => !p.computer && p.connected)) clearRoom(r);
  }
  function reserve(r: Room) {
    if (r.players.some(p => !p.computer && p.connected)) { delete r.expiresAt; return; }
    r.expiresAt ??= Date.now() + recoveryMs;
    const timer = setTimeout(expire, Math.max(1, r.expiresAt - Date.now()));
    timer.unref?.();
    const m = [...members.values()].find(m => m.room === r);
    if (m) { clearTimeout(m.timer); m.timer = timer; }
  }
  for (const r of options.snapshot?.rooms ?? []) {
    rooms.set(r.code, r);
    r.players.forEach(p => { if (!p.computer) p.connected = false; });
  }
  for (const saved of options.snapshot?.members ?? []) {
    const room = rooms.get(saved.code);
    if (!room) continue;
    const m: Member = { room, id: saved.id, token: saved.token, operationId: saved.operationId };
    members.set(m.token, m);
  }
  for (const r of rooms.values()) reserve(r);
  expire();
  for (const r of rooms.values()) {
    if (r.game && r.deadline) {
      const timer = setTimeout(() => { if (r.game) { setGame(r, timeoutGame(r.game)); publish(r); } }, Math.max(0, r.deadline - Date.now()));
      timer.unref?.();
      turnTimers.set(r, timer);
    }
    publish(r);
  }
  wss.on("connection", (ws) => {
    let current: Member | undefined;
    ws.on("message", (raw) => {
      const fail = (message: string, reason?: "unavailable" | "credentials" | "occupied") => send(ws, { type: "error", message, reason });
      try {
        const c = JSON.parse(raw.toString()) as Command;
        if (!c || typeof c !== "object") return fail("Invalid command.");
        if (c.type === "ping") { send(ws, {type: "pong"}); return; }
        expire();
        if (c.type === "create" || c.type === "join") {
          if (c.operationId !== undefined && !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(c.operationId)) return fail("Unable to join. Try again.");
          if (c.operationId && retiredOperations.has(c.operationId)) return fail("This game is no longer available. You can start or join another game.", "unavailable");
          const previous = c.operationId && [...members.values()].find(m => m.operationId === c.operationId);
          if (previous) {
            if (current && current !== previous) return fail("Leave your current table first.");
            if (c.type === "join" && previous.room.code !== c.code.toUpperCase()) return fail("Unable to join. Check the room code.");
            if (previous.socket && previous.socket !== ws && previous.socket.readyState === 1) previous.socket.close(4001, "Session restored elsewhere");
            current = previous;
            previous.socket = ws;
            clearTimeout(previous.timer);
            delete previous.room.expiresAt;
            previous.room.players.find(p => p.id === previous.id)!.connected = true;
            persist();
            send(ws, { type: "state", room: previous.room, playerId: previous.id, token: previous.token });
            publish(previous.room);
            return;
          }
          if (current) return fail("Leave your current table first.");
          if (
            typeof c.name !== "string" ||
            !c.name.trim() ||
            c.name.length > 30
          )
            return fail("Enter a name of 1–30 characters.");
          let room: Room | undefined;
          let colour: (typeof colours)[number];
          if (c.type === "create") {
            const errors = validate(c.rules);
            if (errors.length) return fail(errors.join(" "));
            let code;
            do {
              code = options.roomCode ?? randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
              if (options.roomCode && rooms.has(code)) return fail("Table code is already in use. Please try again.");
            } while (rooms.has(code));
            room = {
              id: randomUUID(),
              code,
              hostId: "",
              rules: structuredClone(c.rules),
              players: [],
              started: false,
              revision: 0,
            };
            colour = colours[0];
            rooms.set(code, room);
            syncBots(room);
          } else {
            if (typeof c.code !== "string") return fail("Invalid room code.");
            room = rooms.get(c.code.toUpperCase());
            if (!room) return fail("This game is no longer available. You can start or join another game.", "unavailable");
            if (room.started) return fail("This match has already started.");
            const i = colours.findIndex(
              (col, i) =>
                i < room!.rules.players &&
                room!.rules.slots[i] === "human" &&
                !room!.players.some((p) => p.colour === col),
            );
            if (i < 0) return fail("No human seat is available.");
            colour = colours[i];
          }
          const id = randomUUID(),
            token = randomBytes(24).toString("hex");
          current = { room, id, token, operationId: c.operationId, socket: ws };
          delete room.expiresAt;
          members.set(token, current);
          room.players.push({
            id,
            name: c.name.trim(),
            colour,
            ready: false,
            computer: false,
            connected: true,
          });
          if (!room.hostId) room.hostId = id;
          persist();
          send(ws, { type: "state", room, playerId: id, token });
          publish(room);
          return;
        }
        if (c.type === "resume") {
          if (current) return fail("Already connected to a table.");
          const m = members.get(c.token);
          if (!rooms.has(c.code)) return fail("This game is no longer available. You can start or join another game.", "unavailable");
          if (!m || m.room.code !== c.code)
            return fail("We couldn't restore your player seat. Check this browser's saved game or return to the lobby.", "credentials");
          // Valid credentials transfer ownership; old socket callbacks cannot affect the new session.
          if (m.socket && m.socket !== ws && m.socket.readyState === 1) m.socket.close(4001, "Session restored elsewhere");
          current = m;
          clearTimeout(m.timer);
          m.socket = ws;
          delete m.room.expiresAt;
          m.room.players.find((p) => p.id === m.id)!.connected = true;
          persist();
          send(ws, {
            type: "state",
            room: m.room,
            playerId: m.id,
            token: m.token,
          });
          publish(m.room);
          return;
        }
        if (!current) return fail("Join a table first.");
        if (current.socket !== ws) return fail("Your player seat is connected in another session.", "occupied");
        const r = current.room;
        if (c.type === "leave") {
          remove(current);
          current = undefined;
          send(ws, { type: "left" });
          return;
        }
        if (
          c.type === "roll" ||
          c.type === "move" ||
          c.type === "pass" ||
          c.type === "skill"
        ) {
          const allowed =
            c.type === "skill"
              ? ["type", "revision", "match", "actionId"]
              : c.type === "move"
                ? ["type", "revision", "match", "moveId"]
                : ["type", "revision", "match"];
          if (Object.keys(c).some((k) => !allowed.includes(k)))
            return fail("Unsupported action fields.");
          if (!r.game) return fail("Start a match first.");
          if (c.match !== r.game.match || c.revision !== r.game.revision)
            return fail("The board has changed. Choose a current action.");
          if (currentPlayer(r.game).id !== current.id)
            return fail("Wait for your turn.");
          const next =
            c.type === "skill"
              ? useSkill(r.game, current.id, c.actionId)
              : c.type === "roll"
                ? rollGame(r.game, current.id, dice())
                : c.type === "move"
                  ? moveGame(r.game, current.id, c.moveId)
                  : passGame(r.game, current.id);
          setGame(r, next);
          publish(r);
          return;
        }
        if (c.type === "rematch") {
          if (!r.game || r.game.phase !== "finished")
            return fail("Finish the match before requesting a rematch.");
          if (
            r.players.length !== r.rules.players ||
            r.players.some((p) => !p.connected)
          )
            return fail("Return to the lobby to fill the seats first.");
          r.rematchReady ??= [];
          if (!r.rematchReady.includes(current.id))
            r.rematchReady.push(current.id);
          if (
            r.players
              .filter((p) => !p.computer)
              .every((p) => r.rematchReady!.includes(p.id))
          )
            setup(r, r.game.match + 1);
          publish(r);
          return;
        }
        if (c.type === "lobby") {
          if (r.hostId !== current.id)
            return fail("Only the host can return everyone to the lobby.");
          if (!r.game || r.game.phase !== "finished")
            return fail("Finish the match first.");
          r.started = false;
          delete r.game;
          delete r.deadline;
          r.rematchReady = [];
          r.players.forEach((p) => (p.ready = p.computer));
          publish(r);
          return;
        }
        if (r.started)
          return fail("Rules and seats are locked during a match.");
        if (c.type === "ready") {
          if (typeof c.ready !== "boolean") return fail("Invalid ready state.");
          r.players.find((p) => p.id === current!.id)!.ready = c.ready;
        } else if (c.type === "rules") {
          if (r.hostId !== current.id)
            return fail("Only the host can edit rules.");
          const errors = validate(c.rules);
          if (errors.length) return fail(errors.join(" "));
          for (const p of r.players.filter((p) => !p.computer)) {
            const i = colours.indexOf(p.colour);
            if (i >= c.rules.players || c.rules.slots[i] !== "human")
              return fail(
                "An occupied human seat cannot be removed or changed.",
              );
          }
          r.rules = structuredClone(c.rules);
          syncBots(r);
          r.players.forEach((p) => {
            if (!p.computer) p.ready = false;
          });
        } else if (c.type === "start") {
          if (r.hostId !== current.id) return fail("Only the host can start.");
          if (
            r.players.length !== r.rules.players ||
            r.players.some((p) => !p.ready || !p.connected)
          )
            return fail("Fill all seats and have everyone ready first.");
          setup(r);
        } else return fail("Unknown command.");
        publish(r);
      } catch (e) {
        fail(e instanceof Error && !(e instanceof TypeError) && !(e instanceof SyntaxError) ? e.message : "We couldn’t process that request. Please try again.");
      }
    });
    ws.on("error", () => {});
    ws.on("close", () => {
      if (!current || current.socket !== ws || !rooms.has(current.room.code)) return;
      const m = current;
      m.socket = undefined;
      const p = m.room.players.find((p) => p.id === m.id);
      if (p) {
        p.connected = false;
        if (!m.room.started) p.ready = false;
      }
      publish(m.room);
      reserve(m.room);
      persist();
    });
  });
  return {
    rooms,
    expire,
    close() {
      for (const m of members.values()) clearTimeout(m.timer);
      for (const t of botTimers.values()) clearTimeout(t);
      for (const t of turnTimers.values()) clearTimeout(t);
    },
  };
}
