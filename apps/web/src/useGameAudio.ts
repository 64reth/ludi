import { useCallback, useEffect, useRef } from "react";
import type { View } from "../../../packages/presentation/index";
export function useGameAudio(view: View, muted: boolean) {
  const ctx = useRef<AudioContext | undefined>(undefined),
    last = useRef("");
  const unlock = useCallback(() => {
    try {
      ctx.current ??= new AudioContext();
      void ctx.current.resume();
    } catch {}
  }, []);
  useEffect(() => {
    if (muted) {
      void ctx.current?.suspend();
      return;
    }
    document.addEventListener("pointerdown", unlock, { capture: true });
    document.addEventListener("keydown", unlock, { capture: true });
    return () => {
      document.removeEventListener("pointerdown", unlock, { capture: true });
      document.removeEventListener("keydown", unlock, { capture: true });
    };
  }, [muted, unlock]);
  useEffect(() => {
    const a = view.active;
    if (!a) return;
    const key = `${a.id}:${view.stage}`;
    if (key === last.current) return;
    last.current = key;
    if (muted || !ctx.current || ctx.current.state !== "running") return;
    const audio = ctx.current;
    function tone(
      frequency: number,
      offset: number,
      length: number,
      volume = 0.025,
    ) {
      const oscillator = audio.createOscillator(),
        gain = audio.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(
        frequency,
        audio.currentTime + offset,
      );
      gain.gain.setValueAtTime(volume, audio.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audio.currentTime + offset + length,
      );
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(audio.currentTime + offset);
      oscillator.stop(audio.currentTime + offset + length);
    }
    if (view.stage === "dice")
      for (let i = 0; i < 4; i++) tone(150 + i * 60, i * 0.065, 0.065, 0.025);
    if (view.stage === "land") tone(210, 0, 0.08);
    if (view.stage === "resolve" && a.captured.length) {
      tone(230, 0, 0.08);
      tone(150, 0.08, 0.12);
    }
    if (view.stage === "resolve" && (a.finished || a.home)) {
      tone(440, 0, 0.1);
      tone(660, 0.1, 0.15);
    }
  }, [view.serial, muted]);
  useEffect(
    () => () => {
      void ctx.current?.close();
    },
    [],
  );
  return unlock;
}
