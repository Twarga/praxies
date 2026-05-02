import { useContext } from "react";
import { EventSourceContext } from "../contexts/EventSourceContext.jsx";

export function useEventSource() {
  const context = useContext(EventSourceContext);

  if (!context) {
    throw new Error("useEventSource must be used within an EventSourceProvider.");
  }

  return context;
}
