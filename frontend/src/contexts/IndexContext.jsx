import { createContext, useCallback, useEffect, useRef, useState } from "react";
import { loadIndex as loadIndexRequest } from "../api/index.js";

export const IndexContext = createContext(null);

const POLLING_STATUSES = new Set(["queued", "transcribing", "analyzing"]);
const POLL_INTERVAL_MS = 3000;

function hasActiveSession(index) {
  if (!index?.sessions) {
    return false;
  }
  return index.sessions.some((s) => POLLING_STATUSES.has(s.status));
}

export function IndexProvider({ children }) {
  const [index, setIndex] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const isMountedRef = useRef(true);

  const refreshIndex = useCallback(async function refreshIndex() {
    setIsLoading(true);
    setError(null);

    try {
      const nextIndex = await loadIndexRequest();
      if (isMountedRef.current) {
        setIndex(nextIndex);
      }
      return nextIndex;
    } catch (caughtError) {
      if (isMountedRef.current) {
        setError(caughtError);
      }
      throw caughtError;
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    refreshIndex().catch(() => {
      // Error state is stored in context for future UI handling.
    });

    return () => {
      isMountedRef.current = false;
    };
  }, [refreshIndex]);

  // Poll every 3s while any session is in an active processing state.
  useEffect(() => {
    if (!hasActiveSession(index)) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      loadIndexRequest()
        .then((nextIndex) => {
          if (isMountedRef.current) {
            setIndex(nextIndex);
          }
        })
        .catch(() => {
          // Silently ignore polling errors to avoid flashing error UI.
        });
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [index]);

  return (
    <IndexContext.Provider
      value={{
        error,
        index,
        isLoading,
        refreshIndex,
      }}
    >
      {children}
    </IndexContext.Provider>
  );
}

