"use client";

import { useEffect, useState } from "react";

export function useApiKey(): string {
  const [apiKey, setApiKey] = useState<string>("");

  useEffect(() => {
    const key = localStorage.getItem("engage_api_key") || "";
    setApiKey(key);
  }, []);

  return apiKey;
}
