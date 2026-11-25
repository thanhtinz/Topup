"use client";
import { useEffect, useState } from "react";

function genRef(): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return "web_" + id;
}

export function ClientRefInput({ scope }: { scope: string }) {
  const [ref, setRef] = useState(genRef);
  useEffect(() => {
    try {
      const key = "cref:" + scope;
      const stored = window.sessionStorage.getItem(key);
      if (stored) {
        setRef(stored);
      } else {
        window.sessionStorage.setItem(key, ref);
      }
    } catch {
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);
  return <input type="hidden" name="clientRef" value={ref} />;
}

export function ClearClientRefs() {
  useEffect(() => {
    try {
      const keys: string[] = [];
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const k = window.sessionStorage.key(i);
        if (k && k.startsWith("cref:")) keys.push(k);
      }
      for (const k of keys) window.sessionStorage.removeItem(k);
    } catch {
    }
  }, []);
  return null;
}
