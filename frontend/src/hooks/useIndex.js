import { useContext } from "react";
import { IndexContext } from "../contexts/IndexContext.jsx";

export function useIndex() {
  const context = useContext(IndexContext);

  if (context === null) {
    throw new Error("useIndex must be used within an IndexProvider.");
  }

  return context;
}
