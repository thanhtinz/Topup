import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { getSettings } from "./settings";
import { encryptSecret, decryptSecret } from "./crypto";
import { applyBalance } from "./wallet";


export const BNTPAY_DEFAULT_API_URL = "https://bntpays.com";
const ENC_PREFIX = "enc:";

export function sealSecret(plain: string): string {
  return plain ? ENC_PREFIX + encryptSecret(plain) : "";
}
export function openSecret(stored: string | undefined): string {
  if (!stored) return "";
  return stored.startsWith(ENC_PREFIX) ? decryptSecret(stored.slice(ENC_PREFIX.length)) : stored;
}


export type SepayConfig = {
  enabled: boolean;
  bankName: string;
  bankBin: string;
  accountNumber: string;
  accountName: string;
  secret: string;
};
export async function getSepayConfig(): Promise<SepayConfig> {
  const s = await getSettings();
  const secret = openSecret(s.sepay_secret);
  return {
    enabled: s.pay_sepay_enabled === "1" && !!s.sepay_account_number && !!secret,
    bankName: s.sepay_bank_name || "",
    bankBin: s.sepay_bank_bin || "",
    accountNumber: s.sepay_account_number || "",
    accountName: s.sepay_account_name || "",
    secret,
  };
}

export const BNTPAY_NETWORKS = ["TRON", "BSC", "ETHEREUM", "POLYGON", "SOLANA", "BASE"] as const;
const BNTPAY_API_NETWORK: Record<string, string> = {
  TRON: "TRC20", ETHEREUM: "ERC20", BSC: "BEP20", POLYGON: "POLYGON", SOLANA: "SOLANA", BASE: "BASE",
};
export function bntpayApiNetwork(internal: string): string {
  return BNTPAY_API_NETWORK[String(internal || "").toUpperCase()] || "TRC20";
}

export type BntpayConfig = {
  enabled: boolean;
  configured: boolean;
  apiKey: string;
  webhookSecret: string;
  apiUrl: string;
  network: string;
  expiresMinutes: number;
};
export async function getBntpayConfig(): Promise<BntpayConfig> {
  const s = await getSettings();
  const apiKey = openSecret(s.bntpay_api_key);
  const webhookSecret = openSecret(s.bntpay_webhook_secret);
  const exp = parseInt(s.bntpay_expires_minutes || "30") || 30;
  return {
    enabled: s.pay_bntpay_enabled === "1" && !!apiKey && !!webhookSecret,
    configured: !!apiKey && !!webhookSecret,
    apiKey,
    webhookSecret,
    apiUrl: (String(s.bntpay_api_url || "").trim() || BNTPAY_DEFAULT_API_URL).replace(/\/+$/, ""),
    network: (BNTPAY_NETWORKS as readonly string[]).includes(s.bntpay_network || "") ? s.bntpay_network : "TRON",
    expiresMinutes: Math.min(60, Math.max(15, exp)),
  };
}


export async function currentVndRate(): Promise<number> {
  const vnd = await prisma.currency.findUnique({ where: { code: "VND" } }).catch(() => null);
  if (vnd && vnd.ratePerUsd > 0) return vnd.ratePerUsd;
  const s = await getSettings();
  return Number(s.fx_usd_vnd) || 0;
}

export function usdToVnd(cents: number, rate: number): number {
  return Math.ceil((cents / 100) * rate);
}

export function extractDepositCode(content: string): string | null {
  const m = String(content || "").toUpperCase().match(/NT\s?\d{4,}/);
  return m ? m[0].replace(/\s/g, "") : null;
}

export function sepayQrUrl(cfg: SepayConfig, vndAmount: number, code: string): string {
  const q = new URLSearchParams({ amount: String(vndAmount), addInfo: code, accountName: cfg.accountName });
  return `https://img.vietqr.io/image/${encodeURIComponent(cfg.bankBin)}-${encodeURIComponent(cfg.accountNumber)}-compact2.png?${q.toString()}`;
}


export async function claimAndCredit(
  tx: Prisma.TransactionClient,
  depositId: number,
  creditCents: number,
  note: string,
): Promise<boolean> {
  const dep = await tx.depositRequest.findUnique({ where: { id: depositId } });
  if (!dep) return false;
  const claim = await tx.depositRequest.updateMany({
    where: { id: depositId, status: "PENDING" },
    data: { status: "APPROVED", decidedAt: new Date(), note },
  });
  if (claim.count !== 1) return false;
  await applyBalance(tx, dep.userId, creditCents, "DEPOSIT", dep.code, note);
  const { notifyUser } = await import("./notify");
  const { fmtUSD } = await import("./money");
  await notifyUser(dep.userId, "DEPOSIT", "Nạp tiền thành công", `+${fmtUSD(creditCents)} đã cộng vào ví của bạn (lệnh ${dep.code}).`, "/account/deposit", tx);
  return true;
}


export function bntpaySign(secret: string, timestamp: string | number, rawBody: string): string {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

export function bntpayVerifySignature(secret: string, timestamp: string, rawBody: string, signature: string): boolean {
  if (!secret || !timestamp || !signature) return false;
  const ts = parseInt(timestamp, 10);
  if (!ts || Math.abs(Date.now() - ts) > 5 * 60 * 1000) return false;
  const expected = bntpaySign(secret, timestamp, rawBody);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.toLowerCase());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export class BntpayError extends Error {
  httpStatus: number;
  constructor(message: string, httpStatus: number) { super(message); this.httpStatus = httpStatus; }
}

async function bntpayFetch<T = Record<string, unknown>>(cfg: BntpayConfig, path: string, body: Record<string, unknown>): Promise<T> {
  const rawBody = JSON.stringify(body);
  const ts = String(Date.now());
  const res = await fetch(`${cfg.apiUrl}${path}`, {
    method: "POST",
    headers: {
      "X-BntPay-Key": cfg.apiKey,
      "X-BntPay-Timestamp": ts,
      "X-BntPay-Signature": bntpaySign(cfg.webhookSecret, ts, rawBody),
      "Content-Type": "application/json",
    },
    body: rawBody,
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  }).catch((e: Error) => { throw new BntpayError(`BNT Pay lỗi mạng: ${e.message}`, 0); });
  const text = await res.text();
  let json: { code?: number; message?: string; data?: unknown } | null = null;
  try { json = JSON.parse(text); } catch { /* giữ null */ }
  if (!res.ok) throw new BntpayError(String(json?.message || `BNT Pay HTTP ${res.status}`), res.status);
  if (json && typeof json.code === "number" && json.code !== 200) {
    throw new BntpayError(String(json.message || `BNT Pay code ${json.code}`), json.code);
  }
  return ((json && typeof json === "object" && "data" in json) ? json.data : (json ?? {})) as T;
}

export type BntpayOrderCreated = {
  checkoutUrl?: string;
  paymentAddress?: string;
  cryptoAmount?: string;
  status?: string;
  expiresAt?: string;
};

export async function bntpayCreateOrder(
  cfg: BntpayConfig,
  input: { externalOrderId: string; amountUsd: number; origin: string },
): Promise<BntpayOrderCreated> {
  const data = await bntpayFetch<Record<string, unknown>>(cfg, "/api/v1/order/create", {
    amount: input.amountUsd,
    externalOrderId: input.externalOrderId,
    network: bntpayApiNetwork(cfg.network),
    currency: "USDT",
    notifyUrl: `${input.origin}/api/webhooks/bntpay`,
    returnUrl: `${input.origin}/account/deposit`,
    expiredMinutes: cfg.expiresMinutes,
    orderDesc: `BNT Top-Up ${input.externalOrderId}`,
  });
  const payment = (data?.payment ?? {}) as Record<string, unknown>;
  const time = (data?.time ?? {}) as Record<string, unknown>;
  return {
    checkoutUrl: typeof data?.checkoutUrl === "string" ? data.checkoutUrl : undefined,
    paymentAddress: typeof payment.address === "string" ? payment.address : undefined,
    cryptoAmount: payment.amount != null ? String(payment.amount) : undefined,
    status: typeof data?.status === "string" ? data.status : "PENDING",
    expiresAt: time.expireTimestamp ? new Date(Number(time.expireTimestamp)).toISOString() : undefined,
  };
}

export async function bntpayGetStatus(cfg: BntpayConfig, externalOrderId: string): Promise<Record<string, unknown>> {
  return bntpayFetch<Record<string, unknown>>(cfg, "/api/v1/order/status", { externalOrderId });
}

export async function bntpayPing(cfg: BntpayConfig): Promise<{ ok: boolean; detail: string }> {
  if (!cfg.apiKey || !cfg.webhookSecret) return { ok: false, detail: "Chưa điền Merchant API Key / Webhook Secret" };
  try {
    await bntpayGetStatus(cfg, "TOPUPPING000001");
    return { ok: true, detail: "Kết nối thành công (đơn dò tồn tại)" };
  } catch (e) {
    if (e instanceof BntpayError && e.httpStatus === 404) return { ok: true, detail: "Kết nối + chữ ký hợp lệ (đơn dò không tồn tại — đúng như kỳ vọng)" };
    if (e instanceof BntpayError) return { ok: false, detail: e.message };
    return { ok: false, detail: "Lỗi không xác định" };
  }
}


export function parseProviderData(raw: string | null | undefined): Record<string, unknown> {
  try { return raw ? (JSON.parse(raw) as Record<string, unknown>) : {}; } catch { return {}; }
}

export async function settleBntpayDeposit(depositId: number, payload: Record<string, unknown>): Promise<{ ok: boolean; reason: string }> {
  const dep = await prisma.depositRequest.findUnique({ where: { id: depositId } });
  if (!dep || dep.method !== "BNTPAY") return { ok: false, reason: "not_found" };
  const status = String(payload?.status || "").toUpperCase();
  if (status === "EXPIRED" || status === "FAILED") {
    await prisma.depositRequest.updateMany({
      where: { id: dep.id, status: "PENDING" },
      data: { status: "REJECTED", decidedAt: new Date(), note: `BNT Pay: ${status === "EXPIRED" ? "hết hạn thanh toán" : "giao dịch thất bại"}` },
    });
    return { ok: true, reason: status.toLowerCase() };
  }
  if (status !== "CONFIRMED" && status !== "COMPLETED") return { ok: false, reason: "not_final" };
  if (dep.status === "APPROVED") return { ok: true, reason: "already" };
  if (dep.status !== "PENDING") return { ok: false, reason: "not_pending" };
  const actualUsd = [payload?.paidAmount, payload?.merchantNetAmount]
    .map((x) => (x === undefined || x === null || x === "" ? NaN : Number(x)))
    .find((x) => Number.isFinite(x) && x > 0);
  const creditedCents = actualUsd !== undefined ? Math.round(actualUsd * 100) : dep.amountCents;
  if (creditedCents <= 0) return { ok: false, reason: "bad_amount" };
  const credited = await prisma.$transaction((tx) => claimAndCredit(tx, dep.id, creditedCents, "Nạp USDT qua BNT Pay"));
  return { ok: credited, reason: credited ? "credited" : "raced" };
}

export async function pollBntpayDeposit(depositId: number): Promise<{ ok: boolean; reason: string }> {
  const dep = await prisma.depositRequest.findUnique({ where: { id: depositId } });
  if (!dep || dep.status !== "PENDING" || dep.method !== "BNTPAY") return { ok: false, reason: "not_pending" };
  const cfg = await getBntpayConfig();
  if (!cfg.configured) return { ok: false, reason: "not_configured" };
  const payload = await bntpayGetStatus(cfg, dep.code);
  return settleBntpayDeposit(depositId, payload);
}
