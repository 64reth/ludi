import { useEffect, useRef, useState } from "react";
import type { Command, Reply, Room } from "../../../packages/shared/index";
export function useLobby(
  enabled: boolean,
  onGame?: (game: Room["game"], reset: boolean) => void,
) {
  const onGameRef = useRef(onGame);
  onGameRef.current = onGame;
  const [room, setRoom] = useState<Room>(),
    [playerId, setPlayerId] = useState(""),
    [connected, setConnected] = useState(false),
    [error, setError] = useState("");
  const socket = useRef<WebSocket | undefined>(undefined),
    credentials = useRef<{ code: string; token: string } | undefined>(
      (() => {
        try {
          return (
            JSON.parse(sessionStorage.getItem("ludi.room") || "null") ||
            undefined
          );
        } catch {
          return undefined;
        }
      })(),
    );
  const [arrival, setArrival] = useState(0);
  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }
    let alive = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    function connect() {
      if (!alive) return;
      const ws = new WebSocket(
        import.meta.env.VITE_WS_URL ||
          `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`,
      );
      socket.current = ws;
      ws.onopen = () => {
        if (!alive) return;
        setConnected(true);
        if (credentials.current)
          ws.send(JSON.stringify({ type: "resume", ...credentials.current }));
      };
      ws.onmessage = (event) => {
        if (!alive) return;
        const r = JSON.parse(event.data) as Reply;
        if (r.type === "error") {
          setError(r.message);
          if (r.message === "Session cannot be resumed.") {
            credentials.current = undefined;
            sessionStorage.removeItem("ludi.room");
            onGameRef.current?.(undefined, true);
            setRoom(undefined);
          }
          return;
        }
        setError("");
        if (r.type === "left") {
          credentials.current = undefined;
          sessionStorage.removeItem("ludi.room");
          onGameRef.current?.(undefined, true);
          setRoom(undefined);
          setArrival((n) => n + 1);
          return;
        }
        onGameRef.current?.(r.room.game, !!r.token);
        setRoom(r.room);
        setPlayerId(r.playerId);
        if (r.token) {
          credentials.current = { code: r.room.code, token: r.token };
          sessionStorage.setItem(
            "ludi.room",
            JSON.stringify(credentials.current),
          );
          setArrival((n) => n + 1);
        }
      };
      ws.onclose = () => {
        if (!alive) return;
        setConnected(false);
        onGameRef.current?.(undefined, true);
        retry = setTimeout(connect, 1500);
      };
      ws.onerror = () => {
        if (alive) setConnected(false);
      };
    }
    connect();
    return () => {
      alive = false;
      clearTimeout(retry);
      socket.current?.close();
    };
  }, [enabled]);
  function send(c: Command) {
    setError("");
    if (socket.current?.readyState !== WebSocket.OPEN) {
      setError("The table connection is unavailable. Reconnecting…");
      return false;
    }
    socket.current.send(JSON.stringify(c));
    return true;
  }
  return { room, playerId, connected, error, setError, send, arrival };
}
