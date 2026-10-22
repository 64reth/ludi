import { useSyncExternalStore } from "react";
// Include short phone landscapes without changing the desktop/tablet layout.
const query =
  "(max-width: 650px), (max-width: 950px) and (max-height: 500px) and (orientation: landscape)";
function subscribe(change: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", change);
  return () => media.removeEventListener("change", change);
}
export function useMobileLayout() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
