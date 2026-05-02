import { useEffect, useRef } from "react";
import { useConfig } from "../hooks/useConfig.js";
import { useEventSource } from "../hooks/useEventSource.js";
import { playReadySound } from "../lib/media.js";

export function LiveUpdateEffects() {
  const { config } = useConfig();
  const { lastEvent } = useEventSource();
  const handledReadyEventRef = useRef(null);

  useEffect(() => {
    if (lastEvent?.type !== "session.ready") {
      return;
    }

    const eventKey = [
      lastEvent.type,
      lastEvent.receivedAt,
      lastEvent.data?.session_id ?? "",
    ].join(":");

    if (handledReadyEventRef.current === eventKey) {
      return;
    }

    handledReadyEventRef.current = eventKey;

    if (config?.ready_sound_enabled) {
      void playReadySound().catch(() => {});
    }
  }, [config?.ready_sound_enabled, lastEvent]);

  return null;
}
