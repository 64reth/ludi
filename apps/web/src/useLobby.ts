import { useEffect, useRef, useState } from "react";
import type { Command, Reply, Room } from "../../../packages/shared/index";
type Saved = { code: string; token: string };
type Pending = Extract<Command, {type: "create" | "join"}>;
function read<T>(key: string): T | undefined {
  try { return JSON.parse(localStorage.getItem(key) || sessionStorage.getItem(key) || "null") || undefined; } catch { return undefined; }
}
function store(key: string, value?: unknown) {
  for (const storage of [localStorage, sessionStorage]) {
    try { if (value) storage.setItem(key, JSON.stringify(value)); else storage.removeItem(key); } catch { /* Private browsing can restrict storage. */ }
  }
}
export function useLobby(enabled: boolean, onGame?: (game: Room["game"], reset: boolean) => void) {
  const onGameRef = useRef(onGame); onGameRef.current = onGame;
  const [room, setRoom] = useState<Room>();
  const [playerId, setPlayerId] = useState("");
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Connecting");
  const [arrival, setArrival] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const credentials = useRef(read<Saved>("ludi.room"));
  const pending = useRef(read<Pending>("ludi.pending"));
  const socket = useRef<WebSocket | undefined>(undefined);
  const accepted = useRef(false);
  const terminal = useRef(false);
  useEffect(() => {
    if (!enabled) { setConnected(false); setReady(false); return; }
    let alive = true, failures = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let lastReply = Date.now();
    terminal.current = false;
    function connect() {
      clearTimeout(retry);
      if (!alive || terminal.current || !navigator.onLine) return;
      const old = socket.current;
      socket.current = undefined;
      old?.close();
      clearInterval(heartbeat); clearTimeout(deadline);
      setReady(false); setConnected(false); accepted.current = false;
      setStatus(credentials.current || pending.current ? "Reconnecting" : "Connecting");
      const ws = new WebSocket(import.meta.env.VITE_WS_URL || `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
      socket.current = ws;
      const current = () => alive && socket.current === ws;
      deadline = setTimeout(() => { if (current()) ws.close(); }, 15000);
      ws.onopen = () => {
        if (!current()) return;
        lastReply = Date.now(); setReady(true);
        if (credentials.current) ws.send(JSON.stringify({type: "resume", ...credentials.current}));
        else if (pending.current) ws.send(JSON.stringify(pending.current));
        else clearTimeout(deadline);
        heartbeat = setInterval(() => {
          if (!current()) return;
          if (Date.now() - lastReply > 45000) { ws.close(); return; }
          if (accepted.current && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({type: "ping"}));
        }, 15000);
      };
      ws.onmessage = event => {
        if (!current()) return;
        lastReply = Date.now();
        let r: Reply;
        try { r = JSON.parse(event.data); } catch { return; }
        if (r.type === "pong") return;
        if (r.type === "error") {
          setError(r.message);
          if (!accepted.current) {
            clearTimeout(deadline);
            terminal.current = true;
            setStatus(r.reason === "unavailable" ? "Room closed" : "Resume failed");
            // A definitive join rejection permits a corrected operation. Transport loss does not.
            if (!credentials.current) { pending.current = undefined; store("ludi.pending"); }
          }
          return;
        }
        if (r.type === "left") {
          credentials.current = undefined; pending.current = undefined;
          store("ludi.room"); store("ludi.pending");
          accepted.current = false; terminal.current = false;
          setConnected(false); setRoom(undefined); setError(""); setStatus("Connecting");
          onGameRef.current?.(undefined, true); setArrival(n => n + 1);
          return;
        }
        clearTimeout(deadline); failures = 0; setError("");
        const restored = !accepted.current;
        accepted.current = true; setConnected(true); setStatus(restored ? "Session restored" : "Connected");
        onGameRef.current?.(r.room.game, restored);
        setRoom(r.room); setPlayerId(r.playerId);
        if (r.token) {
          credentials.current = {code: r.room.code, token: r.token};
          store("ludi.room", credentials.current);
          pending.current = undefined; store("ludi.pending");
          setArrival(n => n + 1);
        }
      };
      ws.onclose = event => {
        if (!current()) return;
        clearInterval(heartbeat); clearTimeout(deadline);
        setReady(false); setConnected(false); accepted.current = false;
        if (event.code === 4001) {
          terminal.current = true; setStatus("Resume failed");
          setError("Your player seat is connected in another session."); return;
        }
        if (terminal.current) return;
        setStatus("Connection interrupted");
        if (failures >= 4) setError("LUDI is temporarily unavailable. Your game may still be saved. Try reconnecting.");
        if (navigator.onLine) retry = setTimeout(connect, Math.min(30000, 750 * 2 ** Math.min(failures++, 6)) * (0.75 + Math.random() * 0.5));
      };
      ws.onerror = () => { if (current()) ws.close(); };
    }
    function wake() {
      if (document.visibilityState === "hidden" || !navigator.onLine || terminal.current) return;
      if (!socket.current || socket.current.readyState > WebSocket.OPEN || Date.now() - lastReply > 45000) connect();
    }
    function offline() { setConnected(false); accepted.current = false; setStatus("Connection interrupted"); socket.current?.close(); }
    window.addEventListener("online", wake); window.addEventListener("offline", offline);
    window.addEventListener("pageshow", wake); document.addEventListener("visibilitychange", wake);
    connect();
    return () => {
      alive = false; clearTimeout(retry); clearTimeout(deadline); clearInterval(heartbeat);
      socket.current?.close();
      window.removeEventListener("online", wake); window.removeEventListener("offline", offline);
      window.removeEventListener("pageshow", wake); document.removeEventListener("visibilitychange", wake);
    };
  }, [enabled, attempt]);
  function send(c: Command) {
    setError("");
    if (c.type === "leave") {
      terminal.current = true;
      if (accepted.current && socket.current?.readyState === WebSocket.OPEN)
        socket.current.send(JSON.stringify(c));
      socket.current?.close(); credentials.current = undefined; pending.current = undefined;
      accepted.current = false; setConnected(false); setReady(false);
      store("ludi.room"); store("ludi.pending"); setRoom(undefined); setArrival(n => n + 1);
      onGameRef.current?.(undefined, true);
      // Open a fresh lobby transport without attempting to reclaim the abandoned seat.
      setAttempt(n => n + 1); return true;
    }
    if (c.type === "create" || c.type === "join") {
      if (credentials.current || pending.current) { setError("Restore or leave your saved game before joining another table."); return false; }
      c = {...c, operationId: crypto.randomUUID()};
      pending.current = c; store("ludi.pending", c); terminal.current = false;
    } else if (!accepted.current) {
      setError("Your connection was lost. Your place is saved. Reconnecting…"); return false;
    }
    if (socket.current?.readyState !== WebSocket.OPEN) {
      setAttempt(n => n + 1); return c.type === "create" || c.type === "join";
    }
    socket.current.send(JSON.stringify(c)); return true;
  }
  return {room, playerId, connected, ready, error, setError, send, arrival, status,
    savedSession: !!credentials.current || !!pending.current,
    retry: () => setAttempt(n => n + 1)};
}
