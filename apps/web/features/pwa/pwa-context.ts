"use client";

import { createContext, useContext } from "react";

export interface PwaRuntimeState {
  online: boolean;
  checkingConnectivity: boolean;
  installed: boolean;
}

export const PwaContext = createContext<PwaRuntimeState>({
  online: true,
  checkingConnectivity: true,
  installed: false,
});

export function usePwaRuntime() {
  return useContext(PwaContext);
}
