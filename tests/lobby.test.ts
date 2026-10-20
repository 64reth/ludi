import { test } from "node:test";
import assert from "node:assert/strict";
import { WebSocket, WebSocketServer } from "ws";
import { attachRooms } from "../apps/server/rooms";
import { preset, validate } from "../packages/rules/index";
import { track, homes } from "../packages/board/geometry";
import type { Reply, Command, Room } from "../packages/shared/index";
test("geometry has stable unique cells", () => {
  assert.equal(track.length, 52);
  assert.equal(new Set(track.map((c) => `${c.x},${c.y}`)).size, 52);
  assert.equal(homes.length, 20);
  assert.equal(new Set([...track, ...homes].map((c) => c.id)).size, 72);
});
test("rules reject malformed and contradictory values", () => {
  const conflicting = { ...preset("don"), extraSix: false };
  assert.deepEqual(validate(conflicting, false), []);
  assert.ok(validate(conflicting).length);
  assert.deepEqual(validate(preset("don")), []);
  assert.deepEqual(validate(preset("life")), []);
  assert.ok(validate({ ...preset("don"), maxBlock: 1 }).length);
  assert.ok(validate({ ...preset("don"), protectedGates: true }).length);
  assert.ok(validate({ ...preset("don"), sixRequired: "yes" }).length);
});
test("real clients synchronise rules, readiness, permissions, lock and resume", async () => {
  const wss = new WebSocketServer({ port: 0 });
  await new Promise<void>((r) => wss.on("listening", r));
  const service = attachRooms(wss);
  const address = wss.address();
  assert.ok(typeof address === "object" && address);
  const url = `ws://127.0.0.1:${address.port}`;
  const sockets: WebSocket[] = [];
  async function client() {
    const ws = new WebSocket(url);
    sockets.push(ws);
    await new Promise<void>((r) => ws.on("open", r));
    const queue: Reply[] = [];
    const waiters: ((r: Reply) => void)[] = [];
    ws.on("message", (b) => {
      const msg = JSON.parse(String(b)) as Reply;
      const next = waiters.shift();
      if (next) next(msg);
      else queue.push(msg);
    });
    return {
      ws,
      send(c: Command) {
        ws.send(JSON.stringify(c));
      },
      async next(predicate: (v: Reply) => boolean): Promise<Reply> {
        for (;;) {
          const v =
            queue.shift() ??
            (await new Promise<Reply>((resolve, reject) => {
              const timeout = setTimeout(
                () => reject(new Error("Reply timeout")),
                2500,
              );
              waiters.push((v) => {
                clearTimeout(timeout);
                resolve(v);
              });
            }));
          if (predicate(v)) return v;
        }
      },
    };
  }
  try {
    const host = await client();
    host.send({ type: "create", name: "Host", rules: preset("don") });
    const created = await host.next((v) => v.type === "state" && !!v.token);
    assert.equal(created.type, "state");
    if (created.type !== "state") return;
    const guest = await client();
    guest.send({ type: "join", name: "Guest", code: created.room.code });
    const joined = await guest.next((v) => v.type === "state" && !!v.token);
    assert.equal(joined.type, "state");
    guest.send({ type: "rules", rules: preset("life") });
    assert.equal((await guest.next((v) => v.type === "error")).type, "error");
    host.send({ type: "rules", rules: { ...preset("life"), maxBlock: 1 } });
    assert.equal((await host.next((v) => v.type === "error")).type, "error");
    host.send({ type: "rules", rules: preset("life") });
    await guest.next(
      (v) => v.type === "state" && v.room.rules.preset === "life",
    );
    host.send({ type: "start" });
    await host.next((v) => v.type === "error");
    host.send({ type: "ready", ready: true });
    guest.send({ type: "ready", ready: true });
    const ready = await host.next(
      (v) => v.type === "state" && v.room.players.every((p) => p.ready),
    );
    assert.equal(ready.type, "state");
    host.send({ type: "start" });
    await guest.next((v) => v.type === "state" && v.room.started);
    host.send({ type: "rules", rules: preset("don") });
    await host.next((v) => v.type === "error");
    if (joined.type === "state") {
      guest.ws.close();
      await host.next(
        (v) => v.type === "state" && v.room.players.some((p) => !p.connected),
      );
      const resumed = await client();
      resumed.send({
        type: "resume",
        code: created.room.code,
        token: joined.token!,
      });
      await resumed.next(
        (v) =>
          v.type === "state" &&
          v.room.started &&
          v.room.players.every((p) => p.connected),
      );
      resumed.send({ type: "leave" });
      await resumed.next((v) => v.type === "left");
    }
    host.send({ type: "leave" });
    await host.next((v) => v.type === "left");
    assert.equal(service.rooms.size, 0);
  } finally {
    for (const ws of sockets) ws.terminate();
    service.close();
    await new Promise<void>((r) => wss.close(() => r()));
  }
});
