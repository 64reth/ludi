import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  PresentationQueue,
  type Pace,
  type PresentationOptions,
} from "../../../packages/presentation/index";
export function loadPace(): Pace {
  try {
    const p = localStorage.getItem("ludi.computerPace");
    if (p === "quick" || p === "normal" || p === "relaxed") return p;
  } catch {}
  return "normal";
}
export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useLayoutEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  return reduced;
}
export function usePresentation(options: PresentationOptions) {
  const queue = useRef<PresentationQueue | undefined>(undefined);
  if (!queue.current) queue.current = new PresentationQueue(options);
  const manager = queue.current;
  const view = useSyncExternalStore(manager.subscribe, manager.snapshot);
  useLayoutEffect(
    () => manager.configure(options),
    [manager, options.pace, options.reduced, options.paused, options.visible],
  );
  // Suspend timers on unmount without destroying the StrictMode remount's subscriptions.
  useLayoutEffect(
    () => () => manager.configure({ ...options, paused: true }),
    [manager],
  );
  return { manager, view };
}
