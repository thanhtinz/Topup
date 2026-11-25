import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { USD_CUR, type Cur } from "@/lib/moneyfmt";
import type { Lang } from "@/lib/i18n";

export type Prefs = { lang: Lang; cur: Cur; currencies: Cur[]; enEnabled: boolean; currencyNames: Record<string, string> };

export async function getPrefs(): Promise<Prefs> {
  const [rows, s, jar] = await Promise.all([
    prisma.currency.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" } }).catch(() => []),
    getSettings(),
    cookies(),
  ]);
  const currencies: Cur[] = rows.map((c) => ({ code: c.code, symbol: c.symbol, ratePerUsd: c.ratePerUsd, decimals: c.decimals }));
  const def = rows.find((c) => c.isDefault) ?? rows[0];
  const cookieCur = jar.get("tp_cur")?.value;
  const cur = currencies.find((c) => c.code === cookieCur) ?? (def ? { code: def.code, symbol: def.symbol, ratePerUsd: def.ratePerUsd, decimals: def.decimals } : USD_CUR);
  const enEnabled = s.lang_en_enabled !== "0";
  const defLang: Lang = s.lang_default === "en" && enEnabled ? "en" : "vi";
  const cookieLang = jar.get("tp_lang")?.value;
  const lang: Lang = cookieLang === "en" && enEnabled ? "en" : cookieLang === "vi" ? "vi" : defLang;
  const currencyNames: Record<string, string> = {};
  for (const c of rows) currencyNames[c.code] = c.name;
  return { lang, cur, currencies: currencies.length ? currencies : [USD_CUR], enEnabled, currencyNames };
}
