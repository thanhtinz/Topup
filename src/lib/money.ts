export function fmtUSD(cents: number): string {
  return "$" + (cents / 100).toFixed(2);
}

export function fmtVND(cents: number, rate: number): string {
  const vnd = Math.round((cents / 100) * rate);
  return vnd.toLocaleString("vi-VN").replace(/,/g, ".") + " ₫";
}

export function priceWithMarkup(costCents: number, markupPercent: number): number {
  return Math.ceil(costCents * (1 + markupPercent / 100));
}

export function parseMoneyToCents(input: string): number | null {
  const n = Number(String(input).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}
