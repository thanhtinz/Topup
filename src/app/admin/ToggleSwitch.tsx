"use client";
import { useRef } from "react";

export default function ToggleSwitch({ action, name, value, checked, label, hidden }: { action: (fd: FormData) => void; name: string; value: string; checked: boolean; label: string; hidden?: Record<string, string> }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form action={action} ref={ref} className="inline-form">
      <input type="hidden" name={name} value={value} />
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <label className="switch" title={label}>
        <input type="checkbox" checked={checked} onChange={() => ref.current?.requestSubmit()} aria-label={label} />
        <span className="track" />
      </label>
    </form>
  );
}
