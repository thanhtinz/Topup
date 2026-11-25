"use client";
import { useState } from "react";

export function ClientRefInput() {
  const [ref] = useState(() => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID().replace(/-/g, "")
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    return "web_" + id;
  });
  return <input type="hidden" name="clientRef" value={ref} />;
}
