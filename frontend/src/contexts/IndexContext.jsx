import { createContext, useEffect, useRef, useState } from "react";
import { loadIndex as loadIndexRequest } from "../api/index.js";

export const IndexContext = createContext(null);

export function IndexProvider({ children }) {
  const [index, setIndex] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const isMountedRef = useRef(true);

  async function refreshIndex() {
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
  }

  useEffect(() => {
    refreshIndex().catch(() => {
      // Error state is stored in context for future UI handling.
    });

    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
