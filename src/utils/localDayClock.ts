import { formatDateKey } from "./date";

/** Resume events handle suspended timers; a minute fallback also catches clock changes. */
export function startLocalDayClock(
  onDay: (day: string) => void,
  subscribeResume: (refresh: () => void) => () => void
): () => void {
  let lastDay = "";
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function refresh() {
    if (stopped) return;
    clearTimeout(timer);
    const now = new Date();
    const day = formatDateKey(now);
    if (day !== lastDay) {
      lastDay = day;
      onDay(day);
    }
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    timer = setTimeout(refresh, Math.max(1, Math.min(60_000, midnight.getTime() - now.getTime())));
  }

  refresh();
  const unsubscribe = subscribeResume(refresh);
  return () => {
    stopped = true;
    clearTimeout(timer);
    unsubscribe();
  };
}
