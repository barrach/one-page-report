import { useEffect, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Auto-save genérico com debounce.
 * - Dispara `saver(value)` após `delay` ms sem alterações.
 * - Pula a primeira chamada (mount) para não salvar valor inicial.
 * - Expõe status para feedback visual discreto.
 */
export function useAutosave<T>(
  value: T,
  saver: (value: T) => Promise<void> | void,
  options: { delay?: number; enabled?: boolean } = {}
) {
  const { delay = 800, enabled = true } = options;
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRun = useRef(true);
  const saverRef = useRef(saver);
  saverRef.current = saver;

  useEffect(() => {
    if (!enabled) return;
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus("saving");
    timerRef.current = setTimeout(async () => {
      try {
        await saverRef.current(value);
        setStatus("saved");
        setLastSavedAt(new Date());
      } catch (err) {
        console.error("[useAutosave] erro ao salvar:", err);
        setStatus("error");
      }
    }, delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(value), delay, enabled]);

  return { status, lastSavedAt };
}
