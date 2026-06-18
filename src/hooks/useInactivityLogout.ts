import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { clearSession } from "@/services/session";

export function useInactivityLogout(timeoutMs = 30 * 60 * 1000) {
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        clearSession();
        navigate({ to: "/login", search: { reason: "timeout" } });
      }, timeoutMs);
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;
    events.forEach((event) => window.addEventListener(event, reset, { passive: true }));
    reset();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((event) => window.removeEventListener(event, reset));
    };
  }, [navigate, timeoutMs]);
}
