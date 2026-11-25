export type GuideStep = { text: string; image: string };

export function parseUidGuide(raw: unknown): GuideStep[] {
  if (!Array.isArray(raw)) return [];
  const steps: GuideStep[] = [];
  for (const item of raw) {
    if (item && typeof item === "object") {
      const text = String((item as { text?: unknown }).text ?? "").trim();
      const image = String((item as { image?: unknown }).image ?? "").trim();
      if (text) steps.push({ text, image });
    }
  }
  return steps;
}

export function guideToText(steps: GuideStep[]): string {
  return steps.map((s) => (s.image ? `${s.text} | ${s.image}` : s.text)).join("\n");
}

export function textToGuide(text: string): GuideStep[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.lastIndexOf("|");
      if (idx > 0) {
        const maybeUrl = line.slice(idx + 1).trim();
        if (/^(https?:\/\/|\/)/.test(maybeUrl)) return { text: line.slice(0, idx).trim(), image: maybeUrl };
      }
      return { text: line, image: "" };
    })
    .filter((s) => s.text);
}
