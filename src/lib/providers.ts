import { decryptSecret } from "./crypto";
import { prisma } from "./db";
import { priceWithMarkup } from "./money";
import { translateErisName } from "./eris-names";


export type CatalogPkg = {
  externalId: string;
  name: string;
  region: string;
  method: string;
  costCents: number;
  imageUrl?: string;
  gameImageUrl?: string;
  fields: Array<{ key: string; label: string; required: boolean; placeholder?: string; options?: Array<{ value: string; label: string }> }>;
  gameName: string;
  gameExternalId: string;
};

async function providerConfig(code: "FZR" | "ERIS") {
  const p = await prisma.provider.findUnique({ where: { code } });
  if (!p || !p.enabled) return null;
  const apiKey = decryptSecret(p.apiKeyEnc);
  if (!apiKey) return null;
  return { ...p, apiKey };
}

const REGION_WORDS: Record<string, string> = {
  asia: "Asia", europe: "Europe", americas: "Americas", america: "America",
  sea: "SEA", mena: "MENA", latam: "LATAM", cis: "CIS", global: "Global",
};
function popRegionSuffix(name: string): { base: string; region: string } | null {
  const m = name.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (!m) return null;
  const label = m[2].trim();
  const word = REGION_WORDS[label.toLowerCase()];
  if (word) return { base: m[1].trim(), region: word };
  if (/^[A-Z]{2,3}(\/[A-Z]{2,3})*$/.test(label)) return { base: m[1].trim(), region: label };
  if (/^[A-Z][a-z]{3,}$/.test(label)) return { base: m[1].trim(), region: label };
  return null;
}

export function parseGameName(raw: string): { base: string; region: string; method: string } {
  let name = raw.replace(/\s*\(Ưu Đãi\)\s*/gi, " ").replace(/\s+/g, " ").trim();
  let method = "";
  const pre = name.match(/^Nạp\s+(Login|UID)\s+/i);
  if (pre) {
    method = pre[1].toLowerCase() === "login" ? "Login" : "UID";
    name = name.slice(pre[0].length).trim();
  }
  let region = "";
  for (let i = 0; i < 3; i++) {
    let m: RegExpMatchArray | null;
    if (!method && (m = name.match(/\s*\((?:Auto\s+)?Via\s+Login\)\s*$/i))) {
      method = "Login"; name = name.slice(0, m.index ?? undefined).trim(); continue;
    }
    if (!method && (m = name.match(/\s*\((Login|UID)\)\s*$/i))) {
      method = m[1].toLowerCase() === "login" ? "Login" : "UID"; name = name.slice(0, m.index ?? undefined).trim(); continue;
    }
    if (!method && (m = name.match(/\s+(Login|UID)\s*$/i)) && (m.index ?? 0) >= 3) {
      method = m[1].toLowerCase() === "login" ? "Login" : "UID"; name = name.slice(0, m.index ?? undefined).trim(); continue;
    }
    if (!region) {
      const r = popRegionSuffix(name);
      if (r) { region = r.region; name = r.base; continue; }
    }
    break;
  }
  return { base: name, region: region || "Global", method };
}

export function inferMethod(fields: Array<{ key: string }>): string {
  return fields.some((f) => f.key === "password") ? "Login" : "UID";
}

class ErisApiError extends Error {
  definitive: boolean;
  syncCode: string;
  constructor(message: string, definitive: boolean, syncCode: string) {
    super(message);
    this.definitive = definitive;
    this.syncCode = syncCode;
  }
}

const ERIS_DEFINITIVE = [400, 401, 402, 403, 404, 422];

async function erisFetch<T = { data?: unknown }>(cfg: { baseUrl: string | null; apiKey: string }, path: string, init?: RequestInit): Promise<T> {
  const base = (cfg.baseUrl || "https://naperis.com").replace(/\/+$/, "");
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "x-api-key": cfg.apiKey,
        "User-Agent": "BNTTopUp/1.0",
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new ErisApiError("Không kết nối được nhà cung cấp", false, "PROVIDER_UNREACHABLE");
  }
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try { json = JSON.parse(text) as Record<string, unknown>; } catch { /* giữ null */ }
  if (!res.ok) {
    const msg = String(json?.message ?? `HTTP ${res.status}`).slice(0, 300);
    throw new ErisApiError(msg, ERIS_DEFINITIVE.includes(res.status), `ERIS_HTTP_${res.status}`);
  }
  if (!json) throw new ErisApiError("Nhà cung cấp trả dữ liệu không hợp lệ", false, "PROVIDER_UNREACHABLE");
  const bodyCode = typeof json.code === "number" ? json.code : 200;
  if (bodyCode !== 200) {
    const msg = String(json.message ?? `Lỗi ${bodyCode}`).slice(0, 300);
    throw new ErisApiError(msg, ERIS_DEFINITIVE.includes(bodyCode), `ERIS_CODE_${bodyCode}`);
  }
  return json as T;
}

export async function getProviderBalance(code: "FZR" | "ERIS"): Promise<string> {
  const cfg = await providerConfig(code);
  if (!cfg) return "Chưa cấu hình hoặc đang tắt";
  try {
    if (code === "ERIS") {
      const j = await erisFetch<{ data?: { balance?: number } }>(cfg, "/api/public/balance");
      const bal = Number(j?.data?.balance ?? NaN);
      return Number.isFinite(bal) ? `${bal.toLocaleString("vi-VN")} VNĐ` : "Không đọc được số dư";
    }
    const res = await fetch(`${cfg.baseUrl || "https://api.fzr.cards"}/api/v2/balance`, {
      headers: { "X-API-Key": cfg.apiKey },
    });
    if (!res.ok) return `Lỗi ${res.status}`;
    const j = await res.json();
    return j?.balance !== undefined ? `${j.balance} ${j.currency ?? "USD"}` : JSON.stringify(j).slice(0, 200);
  } catch (e) {
    if (e instanceof ErisApiError) return `Lỗi: ${e.message}`;
    return "Không kết nối được nhà cung cấp";
  }
}

export type SyncProgress = { phase: string; done: number; total: number };
export async function syncProvider(code: "FZR" | "ERIS", fxRate: number, onProgress?: (p: SyncProgress) => void): Promise<{ games: number; packages: number } | { error: string }> {
  const cfg = await providerConfig(code);
  if (!cfg) return { error: "PROVIDER_NOT_CONFIGURED" };
  let items: CatalogPkg[] = [];
  try {
    if (code === "ERIS") {
      const j = await erisFetch<{ data?: Array<Record<string, unknown>> }>(cfg, "/api/public/categories");
      const cats = (Array.isArray(j?.data) ? j.data : []).filter((c) => String(c.type ?? "TOPUP") === "TOPUP");
      onProgress?.({ phase: "Đã lấy danh mục — đang lấy trường nạp và ảnh của từng game...", done: 0, total: cats.length });
      for (let i = 0; i < cats.length; i += 6) {
        const chunk = cats.slice(i, i + 6);
        const details = await Promise.all(chunk.map(async (cat) => {
          try {
            const d = await erisFetch<{ data?: Record<string, unknown> }>(cfg, `/api/public/categories/${encodeURIComponent(String(cat.id ?? ""))}`);
            return d?.data ?? null;
          } catch { return null; }
        }));
        chunk.forEach((cat, k) => {
          const detail = details[k];
          const fields = ((detail?.formFields ?? []) as Array<Record<string, unknown>>)
            .map((f) => ({
              key: String(f.key ?? ""),
              label: String(f.label ?? f.key ?? ""),
              required: Boolean(f.isRequired),
              options: Array.isArray(f.options)
                ? (f.options as Array<Record<string, unknown> | string>)
                    .map((o) => {
                      if (typeof o === "string") return { value: o, label: o };
                      const value = String(o.value ?? o.label ?? "");
                      return { value, label: String(o.label ?? o.value ?? "") };
                    })
                    .filter((o) => o.value)
                : undefined,
            }))
            .filter((f) => f.key);
          const gameImage = typeof detail?.image === "string" && detail.image.trim() ? detail.image.trim() : undefined;
          const { base, region, method: parsedMethod } = parseGameName(String(cat.name ?? ""));
          const method = parsedMethod || inferMethod(fields);
          const products = (cat.products ?? []) as Array<Record<string, unknown>>;
          for (const pk of products) {
            const costVND = Number(pk.price ?? 0);
            if (!costVND || pk.id == null || pk.id === "") continue; 
            items.push({
              externalId: `${String(cat.id ?? "")}::${String(pk.id)}`,
              name: translateErisName(String(pk.name ?? "")),
              region,
              method,
              costCents: Math.ceil((costVND / fxRate) * 100),
              imageUrl: typeof pk.image === "string" && pk.image.trim() ? pk.image.trim() : undefined,
              gameImageUrl: gameImage,
              gameName: base,
              gameExternalId: String(cat.id ?? ""),
              fields,
            });
          }
        });
        onProgress?.({ phase: "Đang lấy trường nạp và ảnh của từng game...", done: Math.min(i + 6, cats.length), total: cats.length });
      }
    } else {
      const base = cfg.baseUrl || "https://api.fzr.cards";
      const headers = { "X-API-Key": cfg.apiKey };
      const cats: Array<Record<string, unknown>> = [];
      let cursor: string | undefined;
      for (let page = 0; page < 50; page++) {
        const q = new URLSearchParams({ limit: "100", include_ui: "1" });
        if (cursor) q.set("cursor", cursor);
        const res = await fetch(`${base}/api/v2/topups?${q}`, { headers });
        if (!res.ok) return { error: `FZR_HTTP_${res.status}` };
        const j = await res.json();
        const pageItems = (j?.items ?? []) as Array<Record<string, unknown>>;
        cats.push(...pageItems);
        const next = j?.meta?.next_cursor;
        if (!j?.meta?.has_more || !next || pageItems.length === 0) break;
        cursor = String(next);
      }
      onProgress?.({ phase: "Đã lấy danh mục — đang lấy gói của từng game...", done: 0, total: cats.length });
      const perCat: Array<{ cat: Record<string, unknown>; offersRaw: Record<string, unknown> | null }> = [];
      for (let i = 0; i < cats.length; i += 6) {
        const chunk = cats.slice(i, i + 6);
        const got = await Promise.all(chunk.map(async (cat) => {
          try {
            const r = await fetch(`${base}/api/v2/topups/offers?category_id=${encodeURIComponent(String(cat.category_id ?? ""))}&include_ui=1`, { headers });
            if (!r.ok) return { cat, offersRaw: null };
            return { cat, offersRaw: (await r.json()) as Record<string, unknown> };
          } catch { return { cat, offersRaw: null }; }
        }));
        perCat.push(...got);
        onProgress?.({ phase: "Đang lấy gói của từng game...", done: Math.min(i + 6, cats.length), total: cats.length });
      }
      for (const { cat, offersRaw } of perCat) {
        if (!offersRaw) continue;
        const categoryId = String(cat.category_id ?? "");
        if (!categoryId) continue;
        const { base: gameName, region, method: parsedMethod } = parseGameName(String(cat.name ?? offersRaw.name ?? ""));
        const img = (offersRaw.imageurl ?? cat.imageurl) as string | null | undefined;
        const fields = ((offersRaw.fields ?? []) as Array<Record<string, unknown>>)
          .map((f) => ({ key: String(f.key ?? ""), label: String(f.label ?? f.key ?? ""), required: true }))
          .filter((f) => f.key);
        const offers = (offersRaw.offers ?? []) as Array<Record<string, unknown>>;
        for (const o of offers) {
          const offerId = o.offer_id != null && o.offer_id !== "" ? String(o.offer_id) : "";
          const costUSD = Number(o.price_usd ?? NaN);
          if (!offerId || !costUSD) continue; 
          items.push({
            externalId: `${categoryId}::${offerId}`,
            name: String(o.name ?? gameName),
            region,
            method: parsedMethod || inferMethod(fields),
            costCents: Math.ceil(costUSD * 100),
            gameImageUrl: img ? String(img) : undefined,
            gameName,
            gameExternalId: categoryId,
            fields,
          });
        }
      }
    }
  } catch (e) {
    if (e instanceof ErisApiError) return { error: e.syncCode };
    return { error: "PROVIDER_UNREACHABLE" };
  }

  onProgress?.({ phase: "Đang lưu gói vào kho...", done: 0, total: items.length });
  let saved = 0;
  let games = 0;
  const gameCache = new Map<string, number>();
  const mfCache = new Map<number, Record<string, CatalogPkg["fields"]>>();
  const mfDirty = new Set<number>();
  const artCache = new Map<number, { cover: string; bannerUrl: string | null }>();
  const touchedGames = new Set<number>();
  for (const it of items) {
    saved++;
    if (saved % 10 === 0 || saved === items.length) onProgress?.({ phase: "Đang lưu gói vào kho...", done: saved, total: items.length });
    if (!it.gameName || !it.name || !it.externalId) continue;
    const cleanName = it.gameName
      .replace(/\s*\(\s*c[oòó]\s*bill\s*\)\s*/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    let gameId = gameCache.get(cleanName);
    if (gameId === undefined) {
      const existing = await prisma.game.findFirst({ where: { name: { equals: cleanName, mode: "insensitive" } } });
      let slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (!existing && (await prisma.game.findUnique({ where: { slug } }))) slug = `${slug}-${code.toLowerCase()}`;
      const g = existing ?? (await prisma.game.create({
        data: {
          name: cleanName, slug, cover: "", regions: [it.region], fieldsJson: it.fields, compareApproved: false,
          methodFieldsJson: it.method && it.fields.length ? { [it.method]: it.fields } : undefined,
        },
      }));
      if (!mfCache.has(g.id)) {
        mfCache.set(g.id, (g.methodFieldsJson as Record<string, CatalogPkg["fields"]> | null) ?? {});
      }
      if (!existing) games++;
      gameId = g.id;
      gameCache.set(cleanName, gameId);
      artCache.set(gameId, { cover: g.cover, bannerUrl: g.bannerUrl });
    }
    if (it.method && it.fields.length) {
      const mf = mfCache.get(gameId);
      if (mf && JSON.stringify(mf[it.method]) !== JSON.stringify(it.fields)) {
        mf[it.method] = it.fields;
        mfDirty.add(gameId);
      }
    }
    touchedGames.add(gameId);
    if (it.gameImageUrl) {
      const art = artCache.get(gameId);
      if (art && !art.cover) {
        art.cover = it.gameImageUrl;
        await prisma.game.update({ where: { id: gameId }, data: { cover: it.gameImageUrl } });
      }
    }
    const price = priceWithMarkup(it.costCents, cfg.markupPercent);
    const found = await prisma.package.findFirst({ where: { provider: code, externalId: it.externalId } });
    if (found) {
      await prisma.package.update({ where: { id: found.id }, data: { gameId, costCents: it.costCents, priceCents: price, name: it.name, region: it.region, method: it.method, ...(it.imageUrl ? { imageUrl: it.imageUrl } : {}) } });
      if (price < found.priceCents) {
        const { checkPriceAlerts, checkGamePriceDrop } = await import("./engage");
        await checkPriceAlerts(found.id, price).catch(() => 0);
        await checkGamePriceDrop(gameId, it.name, found.priceCents, price).catch(() => 0);
      }
    } else {
      await prisma.package.create({
        data: { gameId, name: it.name, region: it.region, method: it.method, costCents: it.costCents, priceCents: price, provider: code, externalId: it.externalId, imageUrl: it.imageUrl },
      });
    }
  }
  for (const gid of mfDirty) {
    await prisma.game.update({ where: { id: gid }, data: { methodFieldsJson: mfCache.get(gid) } });
  }
  for (const gid of touchedGames) {
    const pkgs = await prisma.package.findMany({ where: { gameId: gid }, select: { region: true } });
    const regions = Array.from(new Set(pkgs.map((p) => p.region))).sort();
    if (regions.length) await prisma.game.update({ where: { id: gid }, data: { regions } });
  }
  await prisma.provider.update({ where: { code }, data: { lastSyncAt: new Date() } });
  onProgress?.({ phase: "Đang lưu gói vào kho...", done: items.length, total: items.length });
  return { games, packages: items.length };
}

export type FulfillResult =
  | { status: "DELIVERED" | "PROCESSING"; providerRef?: string }
  | { status: "PENDING"; reason: string } 
  | { status: "FAILED"; reason: string };

export type FzrGiftOffer = { subId: string; name: string; regions: { region: string; priceUsd: number }[] };

export async function fzrGiftOffers(appid: number): Promise<FzrGiftOffer[] | null> {
  const cfg = await providerConfig("FZR");
  if (!cfg) return null;
  const base = cfg.baseUrl || "https://api.fzr.cards";
  const res = await fetch(`${base}/api/v2/steam-gifts/games/${appid}`, { headers: { "X-API-Key": cfg.apiKey } });
  if (!res.ok) throw new Error(`FZR_GIFT_OFFERS_HTTP_${res.status}`);
  const j: any = await res.json().catch(() => null);
  const offers = Array.isArray(j?.offers) ? j.offers : [];
  return offers
    .map((o: any) => ({
      subId: String(o?.sub_id ?? o?.subId ?? ""),
      name: String(o?.name || ""),
      regions: (Array.isArray(o?.regions) ? o.regions : [])
        .filter((g: any) => g?.region && g?.price !== undefined && g?.price !== null)
        .map((g: any) => ({ region: String(g.region), priceUsd: parseFloat(String(g.price)) }))
        .filter((g: { priceUsd: number }) => Number.isFinite(g.priceUsd) && g.priceUsd > 0),
    }))
    .filter((o: FzrGiftOffer) => o.subId && o.regions.length > 0);
}

export async function fzrGiftGamesList(limit: number): Promise<{ games: { name: string; appid: number }[]; total: number }> {
  const cfg = await providerConfig("FZR");
  if (!cfg) throw new Error("PROVIDER_NOT_CONFIGURED");
  const base = cfg.baseUrl || "https://api.fzr.cards";
  const res = await fetch(`${base}/api/v2/steam-gifts/games?limit=${Math.max(1, Math.floor(limit))}`, {
    headers: { "X-API-Key": cfg.apiKey },
  });
  if (res.status === 429) throw new Error("FZR_GIFT_LIST_429");
  if (!res.ok) throw new Error(`FZR_GIFT_LIST_HTTP_${res.status}`);
  const j: any = await res.json().catch(() => null);
  const items = Array.isArray(j?.games) ? j.games : [];
  return {
    games: items
      .map((g: any) => ({ name: String(g?.name || "").trim(), appid: parseInt(String(g?.appid ?? ""), 10) }))
      .filter((g: { name: string; appid: number }) => g.name && Number.isFinite(g.appid) && g.appid > 0),
    total: parseInt(String(j?.meta?.total ?? items.length), 10) || items.length,
  };
}

export async function fulfillSteamGift(
  orderCode: string,
  itemIndex: number,
  input: { inviteUrl: string; subId: string; appId: number; region: string },
): Promise<FulfillResult> {
  const cfg = await providerConfig("FZR");
  if (!cfg) return { status: "PENDING", reason: "PROVIDER_NOT_CONFIGURED" };
  const base = cfg.baseUrl || "https://api.fzr.cards";
  const headers = { "X-API-Key": cfg.apiKey, "Content-Type": "application/json" };
  try {
    const res = await fetch(`${base}/api/v2/steam-gifts/order`, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": `${orderCode}-${itemIndex}` },
      body: JSON.stringify({
        invite_url: input.inviteUrl,
        sub_id: /^-?\d+$/.test(input.subId) ? Number(input.subId) : input.subId,
        app_id: input.appId,
        region: input.region,
      }),
    });
    if (res.status === 400 || res.status === 404) return { status: "FAILED", reason: `FZR_HTTP_${res.status}` };
    if (!res.ok) return { status: "PENDING", reason: `FZR_HTTP_${res.status}` };
    const j = await res.json().catch(() => null);
    const order = (j?.order ?? j) as Record<string, unknown> | null;
    const ref = order?.id ?? order?.order_id;
    const st = String(order?.status ?? "").toLowerCase();
    if (st === "completed") return { status: "DELIVERED", providerRef: ref ? String(ref) : undefined };
    if (st === "refunded" || st === "cancelled" || st === "failed") return { status: "FAILED", reason: `FZR_ORDER_${st.toUpperCase()}` };
    return { status: "PROCESSING", providerRef: ref ? String(ref) : undefined };
  } catch {
    return { status: "PENDING", reason: "NETWORK_AMBIGUOUS" };
  }
}

export type FzrStarsQuote = { pricePerStar: number; minAmount: number; maxAmount: number };

export async function fzrTelegramStarsQuote(): Promise<FzrStarsQuote | null> {
  const cfg = await providerConfig("FZR");
  if (!cfg) return null;
  const base = cfg.baseUrl || "https://api.fzr.cards";
  const res = await fetch(`${base}/api/v2/telegram/stars`, { headers: { "X-API-Key": cfg.apiKey } });
  if (!res.ok) throw new Error(`FZR_TG_STARS_HTTP_${res.status}`);
  const j: any = await res.json().catch(() => null);
  const pricePerStar = parseFloat(String(j?.price_per_star ?? j?.pricePerStar ?? j?.price ?? "0"));
  if (!Number.isFinite(pricePerStar) || pricePerStar <= 0) return null;
  return {
    pricePerStar,
    minAmount: Number(j?.min_amount ?? j?.minAmount) || 50,
    maxAmount: Number(j?.max_amount ?? j?.maxAmount) || 100000,
  };
}

export async function fzrTelegramPremiumPlans(): Promise<{ months: number; priceUsd: number }[]> {
  const cfg = await providerConfig("FZR");
  if (!cfg) return [];
  const base = cfg.baseUrl || "https://api.fzr.cards";
  const res = await fetch(`${base}/api/v2/telegram/premium`, { headers: { "X-API-Key": cfg.apiKey } });
  if (!res.ok) throw new Error(`FZR_TG_PREMIUM_HTTP_${res.status}`);
  const j: any = await res.json().catch(() => null);
  const plans = Array.isArray(j?.plans) ? j.plans : [];
  return plans
    .map((p: any) => ({ months: Number(p?.months ?? p?.durationMonths), priceUsd: parseFloat(String(p?.price_usd ?? p?.finalPrice ?? p?.price ?? "0")) }))
    .filter((p: { months: number; priceUsd: number }) => Number.isInteger(p.months) && p.months > 0 && Number.isFinite(p.priceUsd) && p.priceUsd > 0)
    .sort((a: { months: number }, b: { months: number }) => a.months - b.months);
}

async function fzrTelegramBuy(orderCode: string, itemIndex: number, path: string, body: Record<string, unknown>): Promise<FulfillResult> {
  const cfg = await providerConfig("FZR");
  if (!cfg) return { status: "PENDING", reason: "PROVIDER_NOT_CONFIGURED" };
  const base = cfg.baseUrl || "https://api.fzr.cards";
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "X-API-Key": cfg.apiKey, "Content-Type": "application/json", "Idempotency-Key": `${orderCode}-${itemIndex}` },
      body: JSON.stringify(body),
    });
    if (res.status === 400 || res.status === 404 || res.status === 422) return { status: "FAILED", reason: `FZR_HTTP_${res.status}` };
    if (!res.ok) return { status: "PENDING", reason: `FZR_HTTP_${res.status}` };
    const j = await res.json().catch(() => null);
    const order = (j?.order ?? j) as Record<string, unknown> | null;
    const ref = order?.id ?? order?.order_id;
    const st = String(order?.status ?? "").toLowerCase();
    if (st === "completed") return { status: "DELIVERED", providerRef: ref ? String(ref) : undefined };
    if (st === "refunded" || st === "cancelled" || st === "failed") return { status: "FAILED", reason: `FZR_ORDER_${st.toUpperCase()}` };
    return { status: "PROCESSING", providerRef: ref ? String(ref) : undefined };
  } catch {
    return { status: "PENDING", reason: "NETWORK_AMBIGUOUS" };
  }
}

export async function fulfillTelegramStars(orderCode: string, itemIndex: number, input: { username: string; quantity: number }): Promise<FulfillResult> {
  return fzrTelegramBuy(orderCode, itemIndex, "/api/v2/telegram/stars/buy", { telegram_username: input.username, quantity: input.quantity });
}

export async function fulfillTelegramPremium(orderCode: string, itemIndex: number, input: { username: string; months: number }): Promise<FulfillResult> {
  return fzrTelegramBuy(orderCode, itemIndex, "/api/v2/telegram/premium/buy", { telegram_username: input.username, months: input.months });
}

export async function fulfillSteamTopup(
  orderCode: string,
  itemIndex: number,
  login: string,
  amountCents: number,
): Promise<FulfillResult> {
  const cfg = await providerConfig("FZR");
  if (!cfg) return { status: "PENDING", reason: "PROVIDER_NOT_CONFIGURED" };
  const base = cfg.baseUrl || "https://api.fzr.cards";
  const headers = { "X-API-Key": cfg.apiKey, "Content-Type": "application/json" };
  try {
    try {
      const chk = await fetch(`${base}/api/v2/steam-topup/check-login`, {
        method: "POST",
        headers,
        body: JSON.stringify({ steamLogin: login }),
      });
      if (chk.status === 400 || chk.status === 422) return { status: "FAILED", reason: `FZR_CHECK_HTTP_${chk.status}` };
      if (chk.ok) {
        const cj = (await chk.json().catch(() => null)) as { can_refill?: boolean } | null;
        if (cj && cj.can_refill === false) return { status: "FAILED", reason: "STEAM_LOGIN_CANNOT_REFILL" };
      }
    } catch {
    }
    const amount = amountCents % 100 === 0 ? String(amountCents / 100) : (amountCents / 100).toFixed(2);
    const res = await fetch(`${base}/api/v2/steam-topup/order`, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": `${orderCode}-${itemIndex}` },
      body: JSON.stringify({ steamLogin: login, currency: "USD", amount }),
    });
    if (res.status === 400 || res.status === 404) return { status: "FAILED", reason: `FZR_HTTP_${res.status}` };
    if (!res.ok) return { status: "PENDING", reason: `FZR_HTTP_${res.status}` };
    const j = await res.json();
    const order = (j?.order ?? j) as Record<string, unknown>;
    const ref = order?.id ?? order?.order_id;
    const st = String(order?.status ?? "").toLowerCase();
    if (st === "completed") return { status: "DELIVERED", providerRef: ref ? String(ref) : undefined };
    if (st === "refunded" || st === "cancelled" || st === "failed") return { status: "FAILED", reason: `FZR_ORDER_${st.toUpperCase()}` };
    return { status: "PROCESSING", providerRef: ref ? String(ref) : undefined };
  } catch {
    return { status: "PENDING", reason: "NETWORK_AMBIGUOUS" };
  }
}

export async function fulfillWithProvider(
  code: "FZR" | "ERIS",
  orderCode: string,
  itemIndex: number,
  pkg: { externalId: string | null },
  fields: Record<string, string>,
): Promise<FulfillResult> {
  const cfg = await providerConfig(code);
  if (!cfg) return { status: "PENDING", reason: "PROVIDER_NOT_CONFIGURED" };
  if (!pkg.externalId) return { status: "PENDING", reason: "NO_EXTERNAL_ID" };
  try {
    if (code === "ERIS") {
      const sep = pkg.externalId.indexOf("::");
      if (sep < 0) return { status: "PENDING", reason: "ERIS_BAD_EXTERNAL_ID" };
      let purchase: { data?: Record<string, unknown> };
      try {
        purchase = await erisFetch<{ data?: Record<string, unknown> }>(cfg, "/api/public/purchase", {
          method: "POST",
          body: JSON.stringify({
            categoryId: pkg.externalId.slice(0, sep),
            productId: pkg.externalId.slice(sep + 2),
            data: fields,
          }),
        });
      } catch (e) {
        if (e instanceof ErisApiError) {
          return e.definitive
            ? { status: "FAILED", reason: e.syncCode }
            : { status: "PENDING", reason: e.syncCode };
        }
        throw e;
      }
      const ref = purchase?.data?.id ?? purchase?.data?.orderId ?? purchase?.data?.order_id;
      return { status: "DELIVERED", providerRef: ref ? String(ref) : undefined };
    }
    const sep = pkg.externalId.indexOf("::");
    if (sep < 0) return { status: "PENDING", reason: "FZR_BAD_EXTERNAL_ID" };
    const res = await fetch(`${cfg.baseUrl || "https://api.fzr.cards"}/api/v2/topups/order`, {
      method: "POST",
      headers: {
        "X-API-Key": cfg.apiKey,
        "Content-Type": "application/json",
        "Idempotency-Key": `${orderCode}-${itemIndex}`,
      },
      body: JSON.stringify({ category_id: pkg.externalId.slice(0, sep), offer_id: pkg.externalId.slice(sep + 2), fields }),
    });
    if (res.status === 400 || res.status === 404) return { status: "FAILED", reason: `FZR_HTTP_${res.status}` };
    if (!res.ok) return { status: "PENDING", reason: `FZR_HTTP_${res.status}` };
    const j = await res.json();
    const order = (j?.order ?? j) as Record<string, unknown>;
    const ref = order?.id ?? order?.order_id;
    const st = String(order?.status ?? "").toLowerCase();
    if (st === "completed") return { status: "DELIVERED", providerRef: ref ? String(ref) : undefined };
    if (st === "refunded" || st === "cancelled" || st === "failed") return { status: "FAILED", reason: `FZR_ORDER_${st.toUpperCase()}` };
    return { status: "PROCESSING", providerRef: ref ? String(ref) : undefined };
  } catch {
    return { status: "PENDING", reason: "NETWORK_AMBIGUOUS" };
  }
}
