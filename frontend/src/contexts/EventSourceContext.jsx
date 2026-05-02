import { createContext, useEffect, useRef, useState } from "react";
import { buildApiUrl } from "../api/client.js";

export const EventSourceContext = createContext(null);

const EVENT_NAMES = ["session.status", "session.ready", "config.changed", "index.changed"];
const BASE_RECONNECT_MS = 1000;
const MAX_RECONNECT_MS = 30000;

function parseEventData(event) {
  if (!event.data) {
    return {};
  }

  try {
    return JSON.parse(event.data);
  } catch {
    return { raw: event.data };
  }
}

function getReconnectDelay(attempt) {
  return Math.min(MAX_RECONNECT_MS, BASE_RECONNECT_MS * 2 ** attempt);
}

export function EventSourceProvider({ children }) {
  const [status, setStatus] = useState("connecting");
  const [lastEvent, setLastEvent] = useState(null);
  const [error, setError] = useState(null);
  const sourceRef = useRef(null);
  const retryAttemptRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    if (typeof EventSource === "undefined") {
      setStatus("unsupported");
      setError("Live updates are not supported in this environment.");

      return () => {
        mountedRef.current = false;
      };
    }

    function clearReconnectTimer() {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    }

    function closeSource(source) {
      source.close();

      if (sourceRef.current === source) {
        sourceRef.current = null;
      }
    }

    function scheduleReconnect() {
      if (!mountedRef.current || reconnectTimerRef.current) {
        return;
      }

      const delay = getReconnectDelay(retryAttemptRef.current);
      retryAttemptRef.current += 1;
      setStatus("reconnecting");
      setError("Live updates disconnected. Reconnecting.");
      reconnectTimerRef.current = window.setTimeout(connect, delay);
    }

    function connect() {
      if (!mountedRef.current) {
        return;
      }

      clearReconnectTimer();

      const source = new EventSource(buildApiUrl("/api/events"));
      sourceRef.current = source;
      setStatus(retryAttemptRef.current > 0 ? "reconnecting" : "connecting");

      source.onopen = () => {
        retryAttemptRef.current = 0;
        setStatus("connected");
        setError(null);
      };

      source.onerror = () => {
        closeSource(source);
        scheduleReconnect();
      };

      for (const eventName of EVENT_NAMES) {
        source.addEventListener(eventName, (event) => {
          setLastEvent({
            type: eventName,
            data: parseEventData(event),
            receivedAt: new Date().toISOString(),
          });
        });
      }
    }

    connect();

    return () => {
      mountedRef.current = false;
      clearReconnectTimer();

      if (sourceRef.current) {
        sourceRef.current.close();
        sourceRef.current = null;
      }
    };
  }, []);

  return (
    <EventSourceContext.Provider value={{ status, lastEvent, error }}>
      {children}
    </EventSourceContext.Provider>
  );
}
