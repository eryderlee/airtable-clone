"use client";

import { useEffect } from "react";
import { api } from "~/trpc/react";

export function BaseToucher({ baseId }: { baseId: string }) {
  const touch = api.base.touch.useMutation();

  useEffect(() => {
    touch.mutate({ id: baseId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseId]);

  return null;
}
