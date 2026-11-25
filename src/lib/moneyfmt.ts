export type Cur = { code: string; symbol: string; ratePerUsd: number; decimals: number };

export function fmtMoney(cents: number, cur: Cur, lang: string): string {
  const amount = (cents / 100) * cur.ratePerUsd;
  try {
    const locale = cur.code === "USD" ? "en-US" : lang === "en" ? "en-US" : "vi-VN";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: cur.code,
      minimumFractionDigits: cur.decimals,
      maximumFractionDigits: cur.decimals,
    }).format(amount);
  } catch {
    return `${amount.toFixed(cur.decimals)} ${cur.symbol}`;
  }
}

export const USD_CUR: Cur = { code: "USD", symbol: "$", ratePerUsd: 1, decimals: 2 };

export function discountOf(priceCents: number, listPriceCents: number | null | undefined): { savings: number; pct: number } | null {
  if (!listPriceCents || listPriceCents <= priceCents) return null;
  const savings = listPriceCents - priceCents;
  return { savings, pct: Math.round((savings / listPriceCents) * 100) };
}
