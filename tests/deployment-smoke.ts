import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { preset } from '../packages/rules/index';
import { currentPlayer, chooseMove } from '../packages/game-engine/index';
import { chooseSkill } from '../packages/war/index';
import type { Reply, Room, Command } from '../packages/shared/index';
const base = process.env.LUDI_URL ?? 'http://127.0.0.1:8787';
const sockets: WebSocket[] = [];
async function client() {
  const ws = new WebSocket(base.replace(/^http/, 'ws') + '/ws', { origin: base });
  sockets.push(ws);
  const queue: Reply[] = [];
  let wake: (() => void) | undefined;
  ws.on('message', data => { queue.push(JSON.parse(String(data))); wake?.(); });
  await new Promise<void>((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  return {
    ws, send(c: Command) { ws.send(JSON.stringify(c)); },
    async next(predicate: (r: Reply) => boolean): Promise<Reply> {
      const end = Date.now() + 15000;
      for (;;) {
        const reply = queue.shift();
        if (reply) { if (predicate(reply)) return reply; continue; }
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(Error('Reply timeout')), Math.max(1, end - Date.now()));
          wake = () => { clearTimeout(timer); wake = undefined; resolve(); };
        });
      }
    },
    async state(predicate: (r: Room) => boolean) {
      const reply = await this.next(r => r.type === 'error' || r.type === 'state' && predicate(r.room));
      if (reply.type !== 'state') throw Error(reply.type === 'error' ? reply.message : 'Missing state');
      return reply;
    },
  };
}
try {
  const health = await fetch(base + '/api/health');
  assert.equal(health.status, 200); assert.equal(((await health.json()) as { build: string }).build, '004A');
  const html = await (await fetch(base)).text();
  assert.match(html, /<div id="root">/);
  for (const asset of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
    const response = await fetch(base + asset[1]); assert.equal(response.status, 200);
    assert.ok((await response.arrayBuffer()).byteLength > 0);
  }
  console.log('PASS frontend, bundled assets and Build 004A health');
  for (const mode of ['heritage', 'war'] as const) {
    const a = await client(), b = await client();
    a.send({ type: 'create', name: 'Deployment check', rules: { ...preset('don'), mode, players: 2, slots: ['human','human','human','human'] } });
    const created = await a.state(() => true);
    b.send({ type: 'join', code: created.room.code, name: 'Verification guest' });
    const joined = await b.state(r => r.players.length === 2);
    a.send({ type: 'ready', ready: true }); b.send({ type: 'ready', ready: true });
    await a.state(r => r.players.every(p => p.ready));
    a.send({ type: 'start' });
    let room = (await a.state(r => !!r.game)).room;
    await b.state(r => !!r.game);
    b.send({ type: 'roll', revision: room.game!.revision, match: room.game!.match });
    const denied = await b.next(r => r.type === 'error');
    assert.equal(denied.type, 'error');
    for (let i = 0; i < 20; i++) {
      const g = room.game!;
      const actor = currentPlayer(g).id === created.playerId ? a : b;
      const skill = chooseSkill(g);
      actor.send(skill ? {type:'skill', actionId:skill.id,revision:g.revision,match:g.match} : g.phase === 'roll'
        ? {type:'roll', revision:g.revision,match:g.match}
        : {type:'move',moveId:chooseMove(g)!.id,revision:g.revision,match:g.match});
      room = (await a.state(r => !!r.game && r.game.revision > g.revision)).room;
      const other = await b.state(r => r.game?.revision === room.game!.revision);
      assert.deepEqual(other.room.game, room.game);
    }
    b.ws.close();
    await a.state(r => r.players.some(p => !p.connected));
    const resumed = await client();
    resumed.send({type:'resume',code:room.code,token:joined.token!});
    const restored = await resumed.state(r => r.players.every(p => p.connected));
    assert.equal(restored.playerId, joined.playerId);
    assert.deepEqual(restored.room.game, room.game);
    resumed.send({type:'leave'}); await resumed.next(r => r.type === 'left');
    a.send({type:'leave'}); await a.next(r => r.type === 'left');
    // The browser reuses its socket when leaving a table or correcting a code.
    a.send({type:'join', code:'000000', name:'Retry check'});
    await a.next(r => r.type === 'error');
    a.send({type:'create', name:'Second table', rules:{...preset('don'), mode}});
    const second = await a.state(() => true);
    resumed.send({type:'join', code:second.room.code, name:'Second guest'});
    await resumed.state(r => r.players.filter(p => !p.computer).length === 2);
    resumed.send({type:'leave'}); await resumed.next(r => r.type === 'left');
    a.send({type:'leave'}); await a.next(r => r.type === 'left');
    a.ws.close(); resumed.ws.close();
    console.log(`PASS ${mode}: room creation/join, readiness, start, authority, 20 synchronised actions and reconnect`);
  }
} finally { for (const ws of sockets) ws.terminate(); }
