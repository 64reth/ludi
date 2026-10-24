import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { WebSocketServer } from 'ws';
import { attachRooms, type RoomSnapshot } from '../apps/server/rooms';
import { preset } from '../packages/rules/index';
import type { Command, Reply } from '../packages/shared/index';
class Socket extends EventEmitter {
  readyState = 1;
  replies: Reply[] = [];
  send(data: string) { this.replies.push(JSON.parse(data)); }
  command(c: Command) { this.emit('message', JSON.stringify(c)); }
  close() { this.readyState = 3; this.emit('close'); }
  state() { const r = [...this.replies].reverse().find(r => r.type === 'state' && !!r.token); assert.ok(r?.type === 'state'); return r; }
}
test('all-human recovery window expires the room, never an individual seat in an active room', t => {
  let now = 1_000_000;
  t.mock.method(Date, 'now', () => now);
  const hub = new EventEmitter();
  let saved: RoomSnapshot | undefined;
  const service = attachRooms(hub as WebSocketServer, {persist: s => { saved = structuredClone(s); }});
  const connect = () => { const s = new Socket(); hub.emit('connection',s); return s; };
  try {
    const a = connect(); a.command({type:'create',name:'Host',rules:preset('don')});
    const created = a.state();
    const b = connect(); b.command({type:'join',name:'Guest',code:created.room.code});
    a.close(); now += 31 * 60_000; service.expire();
    assert.equal(service.rooms.size,1);
    assert.equal(saved!.members.length,2);
    assert.equal(saved!.rooms[0].expiresAt,undefined);
    b.close();
    const expiry = saved!.rooms[0].expiresAt!;
    assert.equal(expiry,now + 30 * 60_000);
    now = expiry - 1; service.expire(); assert.equal(service.rooms.size,1);
    now = expiry; service.expire(); assert.equal(service.rooms.size,0);
    assert.equal(saved!.members.length,0);
  } finally { service.close(); }
});
test('004A snapshots retain room IDs, credentials and seats on restoration', () => {
  const hub = new EventEmitter(); let saved: RoomSnapshot | undefined;
  const first = attachRooms(hub as WebSocketServer, {persist: s => {saved = structuredClone(s);}});
  const a = new Socket(); hub.emit('connection',a);
  a.command({type:'create',name:'Original host',rules:preset('don')});
  const initial = a.state(); first.close();
  const restoredHub = new EventEmitter();
  const restored = attachRooms(restoredHub as WebSocketServer,{snapshot:saved});
  try {
    const b = new Socket(); restoredHub.emit('connection',b);
    b.command({type:'resume',code:initial.room.code,token:initial.token!});
    assert.equal(b.state().room.id,initial.room.id);
    assert.equal(b.state().playerId,initial.playerId);
    assert.equal(b.state().token,initial.token);
  } finally { restored.close(); }
});
