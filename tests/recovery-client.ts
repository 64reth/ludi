import { WebSocket } from "ws";
import type { Reply, Room, Command } from "../packages/shared/index";
export async function client(base: string, sockets: WebSocket[] = []) {
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
