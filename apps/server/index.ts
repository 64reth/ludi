import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { attachRooms } from "./rooms";
const port = Number(process.env.PORT || 3001);
const server = createServer((_, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({ service: "LUDI lobby", build: "003", gameplay: true }),
  );
});
const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 16 * 1024 });
const state = attachRooms(wss);
server.listen(port, "127.0.0.1", () =>
  console.log(`LUDI lobby: ws://127.0.0.1:${port}/ws`),
);
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if ((ws as unknown as { alive: boolean }).alive === false) {
      ws.terminate();
      continue;
    }
    (ws as unknown as { alive: boolean }).alive = false;
    ws.ping();
  }
}, 15000);
wss.on("connection", (ws) => {
  (ws as unknown as { alive: boolean }).alive = true;
  ws.on("pong", () => {
    (ws as unknown as { alive: boolean }).alive = true;
  });
});
function shutdown() {
  clearInterval(heartbeat);
  state.close();
  wss.close();
  for (const ws of wss.clients) ws.terminate();
  server.close();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
