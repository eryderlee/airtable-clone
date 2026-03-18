"use client";

import { createContext, useContext, useState } from "react";

interface BaseColorContextValue {
  liveColor: string | null;
  setLiveColor: (color: string) => void;
}

const BaseColorContext = createContext<BaseColorContextValue>({
  liveColor: null,
  setLiveColor: () => undefined,
});

export function BaseColorProvider({
  initialColor,
  children,
}: {
  initialColor: string | null;
  children: React.ReactNode;
}) {
  const [liveColor, setLiveColor] = useState<string | null>(initialColor);
  return (
    <BaseColorContext.Provider value={{ liveColor, setLiveColor }}>
      {children}
    </BaseColorContext.Provider>
  );
}

export function useBaseColor() {
  return useContext(BaseColorContext);
}
