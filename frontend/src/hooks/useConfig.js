import { useContext } from "react";
import { ConfigContext } from "../contexts/ConfigContext.jsx";

export function useConfig() {
  const context = useContext(ConfigContext);

  if (context === null) {
    throw new Error("useConfig must be used within a ConfigProvider.");
  }

  return context;
}
