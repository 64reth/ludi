// Runs only against an explicitly selected local workerd runtime.
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import { client } from './recovery-client';
import { preset } from '../packages/rules/index';
import { currentPlayer, chooseMove } from '../packages/game-engine/index';
import { chooseSkill, legalSkills } from '../packages/war/index';
import type { Command } from '../packages/shared/index';
const portProbe = createServer();
await new Promise<void>(r => portProbe.listen(0, '127.0.0.1', r));
const address = portProbe.address();
assert.ok(address && typeof address !== 'string');
const port = address.port;
await new Promise<void>(r => portProbe.close(() => r()));
const base = `http://127.0.0.1:${port}`;
const directory = await mkdtemp(join(tmpdir(), 'ludi-004b-'));
const sockets: WebSocket[] = [];
let runtime: ChildProcess | undefined;
let output = '';
async function start() {
  output = '';
  runtime = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'dev', '--local', '--port', String(port), '--inspector-port', '0', '--persist-to', directory], {stdio: ['ignore','pipe','pipe']});
  runtime.stdout?.on('data', b => { output += b; }); runtime.stderr?.on('data', b => { output += b; });
  for (let i = 0; i < 150; i++) {
    if (runtime.exitCode !== null) throw Error(output);
    try { if ((await fetch(base + '/api/health')).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw Error('Local runtime did not start: ' + output);
}
async function stop() {
  if (!runtime || runtime.exitCode !== null) return;
  const ended = new Promise<void>(r => runtime!.once('exit', () => r()));
  runtime.kill('SIGINT'); await ended; runtime = undefined;
}
const connect = () => client(base, sockets);
async function reclaim(code: string, token: string) {
  const c = await connect(); c.send({type:'resume',code,token});
  const state = await c.state(() => true); return {c, state};
}
try {
  await start();
  for (const mode of ['heritage','war'] as const) {
    let a = await connect();
    const create: Command = {type:'create', name:'Host', operationId:randomUUID(), rules:{...preset('don'), mode, players:2, slots:['human','human','human','human']}};
    a.send(create); a.ws.close(); // No initial reply consumed; retry must recover either outcome.
    a = await connect(); a.send(create);
    const created = await a.state(() => true);
    a.send(create);
    assert.equal((await a.state(() => true)).playerId, created.playerId);
    let b = await connect();
    const request: Command = {type:'join',code:created.room.code,name:'Guest',operationId:randomUUID()};
    b.send(request); b.ws.close();
    b = await connect(); b.send(request);
    const joined = await b.state(r => r.players.length === 2);
    assert.equal(joined.room.players.filter(p => !p.computer).length,2);
    assert.equal(JSON.stringify(joined.room).includes(created.token!),false);
    const intruder = await connect();
    intruder.send({type:'resume',code:created.room.code,token:randomUUID()});
    const denied = await intruder.next(r => r.type === 'error');
    assert.equal(denied.type === 'error' && denied.reason,'credentials');
    // Same credentials in a new tab transfer ownership without a second seat.
    const replacement = await reclaim(created.room.code, joined.token!);
    b = replacement.c;
    assert.equal(replacement.state.playerId,joined.playerId);
    a.send({type:'ready',ready:true}); b.send({type:'ready',ready:true});
    await a.state(r => r.players.every(p => p.ready)); a.send({type:'start'});
    let room = (await a.state(r => !!r.game)).room;
    let duplicateRoll = false, duplicatePurchase = false, restarted = false, targeting = false;
    for (let i = 0; i < 12000 && room.game!.phase !== 'finished'; i++) {
      const g = room.game!;
      const actor = currentPlayer(g).id === created.playerId ? a : b;
      const skill = chooseSkill(g);
      const action: Command = skill ? {type:'skill',actionId:skill.id,revision:g.revision,match:g.match} : g.phase === 'roll'
        ? {type:'roll',revision:g.revision,match:g.match}
        : {type:'move',moveId:chooseMove(g)!.id,revision:g.revision,match:g.match};
      actor.send(action);
      const duplicate = action.type === 'roll' && !duplicateRoll || action.type === 'skill' && action.actionId.startsWith('purchase:') && !duplicatePurchase;
      if (duplicate) actor.send(action);
      room = (await a.state(r => !!r.game && r.game.revision > g.revision)).room;
      if (duplicate) {
        await actor.next(r => r.type === 'error');
        duplicateRoll ||= action.type === 'roll'; duplicatePurchase ||= action.type === 'skill';
      }
      const prepared = room.game!.war?.prepared;
      if (mode === 'war' && prepared && Object.keys(prepared).length && !restarted) {
        const saved = structuredClone(room.game);
        // Drop all humans, restart workerd from its SQLite files, then reclaim both seats.
        a.ws.close(); b.ws.close(); await stop(); await start();
        const host = await reclaim(room.code,created.token!); a = host.c;
        const guest = await reclaim(room.code,joined.token!); b = guest.c;
        assert.deepEqual(guest.state.room.game,saved);
        assert.equal(guest.state.room.players.length,2);
        room = guest.state.room; restarted = true;
        console.log('PASS workerd restart, all-human disconnect, War prepared slot/bank/phase/hazards restoration');
      }
      if (mode === 'war' && !targeting && legalSkills(room.game!).length) {
        const saved = structuredClone(room.game);
        const next = await reclaim(room.code,joined.token!); b = next.c;
        assert.deepEqual(next.state.room.game,saved);
        assert.deepEqual(legalSkills(next.state.room.game!),legalSkills(saved!)); targeting = true;
      }
    }
    assert.equal(room.game!.phase,'finished'); assert.ok(duplicateRoll);
    if (mode === 'war') { assert.ok(duplicatePurchase); assert.ok(restarted); assert.ok(targeting); }
    // Refresh each browser independently, then rematch from authoritative results.
    a = (await reclaim(room.code,created.token!)).c;
    b = (await reclaim(room.code,joined.token!)).c;
    a.send({type:'rematch'}); b.send({type:'rematch'});
    const rematch = await a.state(r => r.game?.match === 2);
    assert.equal(rematch.room.game!.phase,'roll');
    a.send({type:'leave'}); await a.next(r => r.type === 'left');
    b.send({type:'leave'}); await b.next(r => r.type === 'left');
    const gone = await connect(); gone.send({type:'resume',code:room.code,token:created.token!});
    const missing = await gone.next(r => r.type === 'error');
    assert.equal(missing.type === 'error' && missing.reason,'unavailable');
    gone.send(create);
    const retired = await gone.next(r => r.type === 'error');
    assert.equal(retired.type === 'error' && retired.reason,'unavailable');
    console.log(`PASS ${mode}: interrupted create/join, idempotent retries, secret isolation, impersonation rejection, tab transfer, duplicate actions, complete match, host/guest refresh, rematch, deleted room`);
  }
} finally {
  for (const ws of sockets) ws.terminate();
  await stop(); await rm(directory,{recursive:true,force:true});
}
