import { createContext, useEffect, useRef, useState } from "react";
import { loadConfig as loadConfigRequest, patchConfig as patchConfigRequest } from "../api/config.js";

export const ConfigContext = createContext(null);

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPatching, setIsPatching] = useState(false);
  const [error, setError] = useState(null);
  const isMountedRef = useRef(true);

  async function refreshConfig() {
    setIsLoading(true);
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
        setIsLoading(false);
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
    refreshConfig().catch(() => {
      // Error state is stored in context for future UI handling.
    });

    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
