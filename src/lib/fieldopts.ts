
export type FieldOption = { value: string; label: string };

const LABELS: Record<string, string> = {
  asia: "Asia",
  europe: "Europe",
  eu: "Europe",
  america: "America",
  americas: "Americas",
  na: "North America",
  "na-and-eu": "North America & Europe",
  "eu-and-na": "Europe & North America",
  sea: "SEA",
  global: "Global",
  us: "US",
  usa: "USA",
  uk: "UK",
  vn: "Vietnam",
  vietnam: "Vietnam",
  jp: "Japan",
  japan: "Japan",
  kr: "Korea",
  korea: "Korea",
  tw: "Taiwan",
  hk: "Hong Kong",
  mo: "Macau",
  sg: "Singapore",
  my: "Malaysia",
  id: "Indonesia",
  ph: "Philippines",
  th: "Thailand",
  in: "India",
  india: "India",
  br: "Brazil",
  ru: "Russia",
  tr: "Turkey",
  mena: "MENA",
  latam: "LATAM",
  cis: "CIS",
  oce: "Oceania",
  au: "Australia",
  ca: "Canada",
  de: "Germany",
  fr: "France",
  es: "Spain",
  it: "Italy",
  cn: "China",
  other: "Other",
};

const ACRONYMS = new Set(["NA", "EU", "SEA", "US", "USA", "UK", "JP", "KR", "TW", "HK", "MENA", "LATAM", "CIS", "ID", "VN"]);

export function prettyOptionLabel(value: string, rawLabel?: string): string {
  const v = value.trim();
  const l = (rawLabel ?? "").trim();
  if (l && l !== v) return l;
  const hit = LABELS[v.toLowerCase()];
  if (hit) return hit;
  return v
    .split(/[-_/]+/)
    .filter(Boolean)
    .map((w) => {
      const up = w.toUpperCase();
      if (ACRONYMS.has(up)) return up;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

export function normOptions(raw: unknown): FieldOption[] {
  if (!Array.isArray(raw)) return [];
  const out: FieldOption[] = [];
  for (const o of raw) {
    if (typeof o === "string") {
      if (o) out.push({ value: o, label: prettyOptionLabel(o) });
    } else if (o && typeof o === "object") {
      const rec = o as Record<string, unknown>;
      const value = String(rec.value ?? rec.label ?? "");
      if (!value) continue;
      const rawLabel = String(rec.label ?? rec.name ?? "");
      out.push({ value, label: prettyOptionLabel(value, rawLabel || undefined) });
    }
  }
  return out;
}
