import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  NoticeQueue,
  type Notice,
} from "../../../packages/presentation/notices";
import type { Game } from "../../../packages/game-engine/index";
export function useWarFeedback(game: Game, error?: string) {
  const queue = useRef(new NoticeQueue()).current,
    key = `${game.match}:${game.players.map((p) => p.id).join(",")}`,
    previous = useRef(""),
    serial = useRef(0);
  useEffect(() => {
    if (!game.war) return;
    const events: Notice[] = game.events
      .filter((e) => e.id !== undefined)
      .map((e) => ({
        id: `${key}:${e.id}`,
        text: e.text,
        tone: e.tone || "war",
        topic: e.topic,
        round: e.round,
      }));
    if (previous.current !== key) {
      previous.current = key;
      queue.reset(events);
    } else queue.receive(events);
  }, [game, key, queue]);
  useEffect(() => {
    if (error && game.war)
      queue.receive([
        {
          id: `rejected:${++serial.current}`,
          text: `Table message: ${error}`,
          tone: "significant",
          topic: "rejected",
        },
      ]);
  }, [error]);
  useEffect(() => {
    queue.pause(false);
    return () => queue.pause(true);
  }, [queue]);
  return {
    queue,
    view: useSyncExternalStore(queue.subscribe, queue.snapshot),
    report: (text: string) =>
      queue.receive([
        {
          id: `selection:${++serial.current}`,
          text: `Selection not made: ${text} Nothing has been spent.`,
          tone: "war",
          topic: "selection",
        },
      ]),
  };
}
