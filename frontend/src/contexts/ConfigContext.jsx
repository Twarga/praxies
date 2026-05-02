import { createContext, useEffect, useRef, useState } from "react";
import { loadConfig as loadConfigRequest, patchConfig as patchConfigRequest } from "../api/config.js";
import { useEventSource } from "../hooks/useEventSource.js";

export const ConfigContext = createContext(null);

export function ConfigProvider({ children }) {
  const { lastEvent } = useEventSource();
  const [config, setConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPatching, setIsPatching] = useState(false);
  const [error, setError] = useState(null);
  const isMountedRef = useRef(true);

  async function refreshConfig({ silent = false } = {}) {
    if (!silent) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const nextConfig = await loadConfigRequest();
      if (isMountedRef.current) {
        setConfig(nextConfig);
      }
      return nextConfig;
    } catch (caughtError) {
      if (isMountedRef.current) {
        setError(caughtError);
      }
      throw caughtError;
    } finally {
      if (isMountedRef.current) {
        if (!silent) {
          setIsLoading(false);
        }
      }
    }
  }

  async function patchConfig(patch) {
    setIsPatching(true);
    setError(null);

    try {
      const nextConfig = await patchConfigRequest(patch);
      if (isMountedRef.current) {
        setConfig(nextConfig);
      }
      return nextConfig;
    } catch (caughtError) {
      if (isMountedRef.current) {
        setError(caughtError);
      }
      throw caughtError;
    } finally {
      if (isMountedRef.current) {
        setIsPatching(false);
      }
    }
  }

  useEffect(() => {
    isMountedRef.current = true;

    refreshConfig().catch(() => {
      // Error state is stored in context for future UI handling.
    });

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (lastEvent?.type !== "config.changed") {
      return;
    }

    refreshConfig({ silent: true }).catch(() => {
      // Error state is stored in context for future UI handling.
    });
  }, [lastEvent]);

  return (
    <ConfigContext.Provider
      value={{
        config,
        error,
        isLoading,
        isPatching,
        patchConfig,
        refreshConfig,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
}
