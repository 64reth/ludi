import { DurableObject } from 'cloudflare:workers';
import { EventEmitter } from 'node:events';
import type { WebSocket as NodeSocket, WebSocketServer } from 'ws';
import { attachRooms, type RoomSnapshot } from '../server/rooms';

// Adapt the existing authoritative room protocol without shipping the Node ws server.
class SocketAdapter extends EventEmitter {
  constructor(readonly socket: WebSocket) {
    super();
    socket.addEventListener('message', e => {
      if (typeof e.data !== 'string' || new TextEncoder().encode(e.data).length > 16384) {
        socket.close(1009, 'Message too large'); return;
      }
      this.emit('message', e.data);
    });
    socket.addEventListener('close', () => this.emit('close'));
    socket.addEventListener('error', () => this.emit('error'));
  }
  get readyState() { return this.socket.readyState; }
  send(data: string) { this.socket.send(data); }
  close(code?: number, reason?: string) { this.socket.close(code, reason); }
}

export class LudiRoom extends DurableObject<Env> {
  private hub = new EventEmitter();
  private initialized = false;
  private service?: ReturnType<typeof attachRooms>;
  private persist = (value: RoomSnapshot) => {
    const expiry = value.rooms.map(r => r.expiresAt).filter((v): v is number => !!v);
    this.ctx.waitUntil(Promise.all([
      this.ctx.storage.put('room', value),
      expiry.length ? this.ctx.storage.setAlarm(Math.min(...expiry)) : this.ctx.storage.deleteAlarm(),
    ]));
  };
  async alarm() { this.service?.expire(); }

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const snapshot = await ctx.storage.get<RoomSnapshot>('room');
      const code = await ctx.storage.get<string>('code');
      this.initialized = !!code;
      this.service = attachRooms(this.hub as WebSocketServer, {
        snapshot, roomCode: code,
        persist: this.persist,
      });
    });
  }
  async fetch(request: Request): Promise<Response> {
    const code = new URL(request.url).pathname.slice(1);
    // Initialize the fixed room code before accepting the first command.
    if (!this.initialized) {
      await this.ctx.blockConcurrencyWhile(async () => {
        if (this.initialized) return;
        await this.ctx.storage.put('code', code);
        this.hub = new EventEmitter();
        this.service = attachRooms(this.hub as WebSocketServer, {
          roomCode: code,
          persist: this.persist,
        });
        this.initialized = true;
      });
    }
    const pair = new WebSocketPair();
    pair[1].accept();
    this.hub.emit('connection', new SocketAdapter(pair[1]) as unknown as NodeSocket);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') return Response.json({ service: 'LUDI', build: '004B', multiplayer: 'durable-objects' });
    if (url.pathname !== '/ws') return env.ASSETS.fetch(request);
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('WebSocket required', { status: 426 });
    const origin = request.headers.get('Origin');
    if (origin && origin !== url.origin) return new Response('Origin denied', { status: 403 });
    const pair = new WebSocketPair();
    const client = pair[1];
    client.accept();
    let upstream: WebSocket | undefined;
    let opening = false;
    const idle = setTimeout(() => client.close(1000, 'Please reconnect'), 120_000);
    client.addEventListener('message', async event => {
      try {
        if (typeof event.data !== 'string' || new TextEncoder().encode(event.data).length > 16384) { client.close(1009, 'Message too large'); return; }
        if (upstream) { upstream.send(event.data); return; }
        if (opening) return;
        const command = JSON.parse(event.data);
        if (!['create', 'join', 'resume'].includes(command?.type)) { client.send(JSON.stringify({ type: 'error', message: 'Join a table first.' })); return; }
        opening = true;
        const operationHash = typeof command.operationId === 'string' ? await crypto.subtle.digest('SHA-256', new TextEncoder().encode(command.operationId)) : undefined;
        const code = command.type === 'create'
          ? (operationHash ? Array.from(new Uint8Array(operationHash), b => b.toString(16).padStart(2, '0')).join('') : crypto.randomUUID().replaceAll('-', '')).slice(0, 6).toUpperCase()
          : typeof command.code === 'string' ? command.code.toUpperCase() : '';
        if (!/^[A-F0-9]{6}$/.test(code)) { opening = false; client.send(JSON.stringify({ type: 'error', message: 'Invalid room code.' })); return; }
        opening = true;
        const response = await env.ROOMS.getByName(code).fetch(`https://room/${code}`, { headers: { Upgrade: 'websocket' } });
        upstream = response.webSocket ?? undefined;
        if (!upstream) throw new Error('Room unavailable');
        upstream.accept();
        clearTimeout(idle);
        const source = upstream;
        let seated = false;
        source.addEventListener('message', e => {
          if (upstream !== source || client.readyState !== 1) return;
          const reply = JSON.parse(String(e.data));
          if (reply.type === 'state' && reply.token) seated = true;
          if (reply.type === 'left' || reply.type === 'error' && !seated) {
            upstream = undefined;
            opening = false;
            source.close();
          }
          client.send(e.data);
        });
        source.addEventListener('close', e => { if (upstream === source && client.readyState === 1) client.close(e.code === 4001 ? 4001 : 1012, e.code === 4001 ? 'Session restored elsewhere' : 'Reconnect'); });
        source.addEventListener('error', () => { if (upstream === source && client.readyState === 1) client.close(1011, 'Connection interrupted'); });
        if (client.readyState !== 1) { upstream.close(); return; }
        upstream.send(event.data);
      } catch {
        if (client.readyState === 1) client.close(1011, 'Connection interrupted');
      }
    });
    client.addEventListener('close', () => { clearTimeout(idle); if (upstream?.readyState === 1) upstream.close(); });
    client.addEventListener('error', () => { clearTimeout(idle); if (upstream?.readyState === 1) upstream.close(); });
    return new Response(null, { status: 101, webSocket: pair[0] });
  },
} satisfies ExportedHandler<Env>;
