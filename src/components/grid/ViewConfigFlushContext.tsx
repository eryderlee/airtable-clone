"use client";

import { createContext, useContext, useRef, useCallback } from "react";

type FlushFn = () => Promise<void>;

interface ViewConfigFlushContextValue {
  register: (fn: FlushFn) => void;
  unregister: () => void;
  flush: () => Promise<void>;
}

const ViewConfigFlushContext = createContext<ViewConfigFlushContextValue>({
  register: () => undefined,
  unregister: () => undefined,
  flush: () => Promise.resolve(),
});

export function ViewConfigFlushProvider({ children }: { children: React.ReactNode }) {
  const flushRef = useRef<FlushFn | null>(null);

  const register = useCallback((fn: FlushFn) => {
    flushRef.current = fn;
  }, []);

  const unregister = useCallback(() => {
    flushRef.current = null;
  }, []);

  const flush = useCallback(async () => {
    if (flushRef.current) await flushRef.current();
  }, []);

  return (
    <ViewConfigFlushContext.Provider value={{ register, unregister, flush }}>
      {children}
    </ViewConfigFlushContext.Provider>
  );
}

export function useViewConfigFlush() {
  return useContext(ViewConfigFlushContext);
}
