"use client";

import { useEffect, useState } from "react";

export function useApiKey(): string {
  const [prefix, setPrefix] = useState<string>("");

  useEffect(() => {
    fetch("/api/session")
      .then(
        (r) => r.json() as Promise<{ authenticated: boolean; prefix?: string }>,
      )
      .then((s) => setPrefix(s.prefix ?? ""))
      .catch(() => {});
  }, []);

  return prefix;
}
