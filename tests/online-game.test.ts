import { chooseSkill } from "../packages/war/index";
import { test } from "node:test";
import assert from "node:assert/strict";
import { WebSocket, WebSocketServer } from "ws";
import { attachRooms } from "../apps/server/rooms";
import { preset, type Rules } from "../packages/rules/index";
import { chooseMove, currentPlayer } from "../packages/game-engine/index";
import type { Command, Reply, Room } from "../packages/shared/index";
for (const mode of ["heritage", "war"] as const)
  test(`${mode}: authoritative online match rejects tampering, finishes, synchronises and rematches`, async () => {
    let seed = 732;
    const die = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return 1 + ((seed >>> 8) % 6);
    };
    const wss = new WebSocketServer({ port: 0 });
    await new Promise<void>((r) => wss.on("listening", r));
    const service = attachRooms(wss, { rollDice: () => [die(), die()] });
    const addr = wss.address();
    assert.ok(typeof addr === "object" && addr);
    const port = addr.port;
    const sockets: WebSocket[] = [];
    async function client() {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`);
      sockets.push(ws);
      await new Promise<void>((r) => ws.on("open", r));
      const queue: Reply[] = [];
      let wake: (() => void) | undefined;
      ws.on("message", (b) => {
        queue.push(JSON.parse(String(b)));
        wake?.();
      });
      return {
        ws,
        send(c: Command) {
          ws.send(JSON.stringify(c));
        },
        async next(predicate: (r: Reply) => boolean): Promise<Reply> {
          for (;;) {
            const v = queue.shift();
            if (v) {
              if (predicate(v)) return v;
              continue;
            }
            await new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(
                () => reject(Error("Reply timed out")),
                3000,
              );
              wake = () => {
                clearTimeout(timeout);
                wake = undefined;
                resolve();
              };
            });
          }
        },
        async state(predicate: (r: Room) => boolean) {
          const msg = await this.next(
            (m) => m.type === "state" && predicate(m.room),
          );
          assert.equal(msg.type, "state");
          return msg.type === "state" ? msg.room : (undefined as never);
        },
      };
    }
    try {
      const a = await client(),
        b = await client();
      const r: Rules = {
        ...preset("don"),
        mode,
        players: 2,
        slots: ["human", "human", "human", "human"],
      };
      a.send({ type: "create", name: "Host", rules: r });
      const created = await a.state(() => true);
      b.send({ type: "join", name: "Guest", code: created.code });
      await b.state((r) => r.players.length === 2);
      a.send({ type: "ready", ready: true });
      b.send({ type: "ready", ready: true });
      await a.state((r) => r.players.every((p) => p.ready));
      a.send({ type: "start" });
      let room = await a.state((r) => !!r.game);
      await b.state((r) => !!r.game);
      const first = room.game!;
      b.send({ type: "roll", revision: first.revision, match: first.match });
      assert.match(
        ((await b.next((v) => v.type === "error")) as { message: string })
          .message,
        /turn/,
      );
      a.send({
        type: "roll",
        revision: first.revision,
        match: first.match,
        dice: [6, 6],
      } as unknown as Command);
      assert.match(
        ((await a.next((v) => v.type === "error")) as { message: string })
          .message,
        /Unsupported/,
      );
      a.send({ type: "rules", rules: r });
      await a.next((v) => v.type === "error");
      a.send({
        type: "move",
        moveId: "forged",
        revision: first.revision,
        match: first.match,
      });
      await a.next((v) => v.type === "error");
      a.send({
        type: "skill",
        actionId: "forged",
        revision: first.revision,
        match: first.match,
      });
      await a.next((v) => v.type === "error");
      a.ws.send(
        JSON.stringify({
          type: "skill",
          actionId: "forged",
          revision: first.revision,
          match: first.match,
          bank: 12,
        }),
      );
      assert.match(
        ((await a.next((v) => v.type === "error")) as { message: string })
          .message,
        /Unsupported/,
      );
      const hostId = room.hostId;
      let actions = 0, purchases = 0, deployments = 0;
      while (room.game!.phase !== "finished" && actions++ < 6000) {
        const g = room.game!,
          actor = currentPlayer(g).id === hostId ? a : b;
        const skill = chooseSkill(g);
        const command: Command = skill
          ? {
              type: "skill",
              actionId: skill.id,
              revision: g.revision,
              match: g.match,
            }
          : g.phase === "roll"
            ? { type: "roll", revision: g.revision, match: g.match }
            : {
                type: "move",
                moveId: chooseMove(g)!.id,
                revision: g.revision,
                match: g.match,
              };
        actor.send(command);
        room = await a.state((r) => !!r.game && r.game.revision > g.revision);
        const other = await b.state(
          (r) => !!r.game && r.game.revision === room.game!.revision,
        );
        assert.deepEqual(other.game, room.game);
        if (skill) {
          const owner = currentPlayer(g).id;
          if (skill.id.startsWith("purchase:")) {
            purchases++;
            assert.equal(room.game!.war!.prepared![owner], skill.skill);
            assert.equal(room.game!.war!.bank[owner], g.war!.bank[owner] - skill.cost);
            assert.deepEqual(room.game!.players, g.players);
            assert.equal(room.game!.war!.window, true);
          } else {
            deployments++;
            assert.equal(room.game!.war!.prepared![owner], undefined);
            assert.equal(room.game!.war!.bank[owner], g.war!.bank[owner]);
            assert.equal(room.game!.war!.window, false);
          }
        }
        if (actions === 2) {
          actor.send(command);
          const err = await actor.next((v) => v.type === "error");
          assert.match((err as { message: string }).message, /changed/);
        }
      }
      assert.ok(room.game!.winnerId, "No online winner");
      assert.ok(
        room.game!.players.some((p) => p.pieces.every((v) => v === 56)),
      );
      assert.ok(
        room.game!.players.reduce((n, p) => n + p.captures, 0) > 0,
        "Match should exercise captures",
      );
      if (mode === "war") { assert.ok(purchases > 0); assert.ok(deployments > 0); }
      const old = room.game!;
      a.send({ type: "rematch" });
      await a.state((r) => r.rematchReady?.length === 1);
      b.send({ type: "rematch" });
      room = await a.state((r) => r.game?.match === 2);
      await b.state((r) => r.game?.match === 2);
      assert.equal(room.game!.phase, "roll");
      assert.equal(room.game!.current, 1);
      if (mode === "war") {
        assert.ok(room.game!.war);
        assert.ok(Object.values(room.game!.war!.bank).every((v) => v === 0));
        assert.equal(room.game!.war!.round, 1);
        assert.deepEqual(room.game!.war!.prepared, {});
      }
      assert.deepEqual(room.rules, r);
      assert.ok(
        room.game!.players.every((p) => p.pieces.every((v) => v === -1)),
      );
      a.send({ type: "roll", revision: old.revision, match: old.match });
      await a.next((v) => v.type === "error");
    } finally {
      for (const ws of sockets) ws.terminate();
      service.close();
      await new Promise<void>((r) => wss.close(() => r()));
    }
  });

for (const mode of ["heritage", "war"] as const)
  test(`${mode}: server-controlled computer completes a real match using only legal actions`, async () => {
    const wss = new WebSocketServer({ port: 0 });
    await new Promise<void>((r) => wss.on("listening", r));
    let seed = 9876;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return 1 + ((seed >>> 12) % 6);
    };
    const service = attachRooms(wss, {
      rollDice: () => [random(), random()],
      botDelay: 1,
    });
    const addr = wss.address();
    assert.ok(typeof addr === "object" && addr);
    const ws = new WebSocket(`ws://127.0.0.1:${addr.port}`);
    const queue: Reply[] = [];
    let wake: (() => void) | undefined;
    ws.on("message", (b) => {
      queue.push(JSON.parse(String(b)));
      wake?.();
    });
    await new Promise<void>((r) => ws.on("open", r));
    async function state(predicate: (r: Room) => boolean): Promise<Room> {
      for (;;) {
        const r = queue.shift();
        if (r) {
          if (r.type === "error") throw Error(r.message);
          if (r.type === "state" && predicate(r.room)) return r.room;
          continue;
        }
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(
            () => reject(Error("Computer did not act")),
            3000,
          );
          wake = () => {
            clearTimeout(t);
            wake = undefined;
            resolve();
          };
        });
      }
    }
    const send = (c: Command) => ws.send(JSON.stringify(c));
    try {
      send({
        type: "create",
        name: "Human",
        rules: {
          ...preset("don"),
          mode,
          players: 2,
          slots: ["human", "computer", "computer", "computer"],
        },
      });
      await state(() => true);
      send({ type: "ready", ready: true });
      await state((r) => r.players.every((p) => p.ready));
      send({ type: "start" });
      let room = await state((r) => !!r.game);
      let botActions = 0,
        actions = 0;
      while (room.game!.phase !== "finished" && actions++ < 6000) {
        const g = room.game!,
          p = currentPlayer(g);
        if (p.computer) botActions++;
        else {
          const skill = chooseSkill(g);
          send(
            skill
              ? {
                  type: "skill",
                  actionId: skill.id,
                  revision: g.revision,
                  match: g.match,
                }
              : g.phase === "roll"
                ? { type: "roll", revision: g.revision, match: g.match }
                : {
                    type: "move",
                    moveId: chooseMove(g)!.id,
                    revision: g.revision,
                    match: g.match,
                  },
          );
        }
        room = await state((r) => !!r.game && r.game.revision > g.revision);
      }
      assert.ok(botActions > 0);
      assert.ok(room.game!.winnerId);
      assert.ok(
        room
          .game!.players.find((p) => p.id === room.game!.winnerId)!
          .pieces.every((v) => v === 56),
      );
    } finally {
      ws.terminate();
      service.close();
      await new Promise<void>((r) => wss.close(() => r()));
    }
  });
