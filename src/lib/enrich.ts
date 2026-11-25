import { prisma } from "./db";
import { getSettings, setSetting } from "./settings";
import { squareRemoteCover } from "./squarecover";
import type { SyncState } from "./sync";

async function getSetting(key: string): Promise<string> {
  const s = await getSettings();
  return s[key] ?? "";
}

const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36" };

export function normalizeName(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

const GENRE_VI: Record<string, string> = {
  "action": "Hành động", "adventure": "Phiêu lưu", "roleplaying": "Nhập vai",
  "role-playing": "Nhập vai", "strategy": "Chiến thuật", "racing": "Đua xe",
  "simulation": "Mô phỏng", "puzzle": "Giải đố", "sports": "Thể thao",
  "casual": "Giải trí nhẹ", "board": "Cờ bàn", "card": "Thẻ bài",
  "music": "Âm nhạc", "trivia": "Đố vui", "word": "Ô chữ", "casino": "Casino",
  "family": "Gia đình", "education": "Giáo dục", "arcade": "Arcade",
  "entertainment": "Giải trí",
};

type ItunesHit = { cover: string; genre: string; description: string };
async function itunesLookup(name: string): Promise<ItunesHit | null> {
  try {
    const u = `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=software&limit=5&country=US`;
    const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(12000) });
    if (!r.ok) return null;
    const j = (await r.json()) as { results?: Array<{ trackName?: string; artworkUrl512?: string; artworkUrl100?: string; genres?: string[] }> };
    const target = normalizeName(name);
    const list = j.results ?? [];
    let hit = list.find((x) => normalizeName(x.trackName ?? "") === target);
    if (!hit && target.length >= 5) {
      hit = list.find((x) => normalizeName(x.trackName ?? "").startsWith(target + " "));
    }
    if (!hit) return null;
    const cover = (hit.artworkUrl512 ?? "").replace("512x512bb", "1024x1024bb") || (hit.artworkUrl100 ? hit.artworkUrl100.replace("100x100bb", "1024x1024bb") : "");
    const g = (hit.genres ?? []).map((x) => x.toLowerCase()).find((x) => x !== "games" && GENRE_VI[x]) ?? "";
    const description = stripHtml((hit as { description?: string }).description ?? "");
    return { cover: cover ?? "", genre: g ? GENRE_VI[g] : "", description };
  } catch { return null; }
}

function stripHtml(x: string): string {
  return x.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{3,}/g, "\n\n").trim().slice(0, 4000);
}

async function playLookup(name: string): Promise<{ banner: string; genre: string; description: string } | null> {
  try {
    const gplay = (await import("google-play-scraper")).default as unknown as {
      search: (o: Record<string, unknown>) => Promise<Array<{ appId: string; title: string }>>;
      app: (o: Record<string, unknown>) => Promise<{ headerImage?: string; genre?: string; description?: string }>;
    };
    const target = normalizeName(name);
    for (const country of ["us", "vn", "sg"]) {
      const res = await gplay.search({ term: name, num: 5, country, lang: "en" }).catch(() => []);
      const hit = res.find((x) => normalizeName(x.title) === target);
      if (hit) {
        const full = await gplay.app({ appId: hit.appId, country, lang: "en" }).catch(() => null);
        if (full) {
          const banner = full.headerImage ? hiResPlayUrl(full.headerImage) : "";
          const genre = GENRE_VI[(full.genre ?? "").toLowerCase()] ?? "";
          const description = stripHtml(full.description ?? "");
          if (banner || genre || description) return { banner, genre, description };
        }
      }
    }
  } catch { /* bỏ qua nguồn này */ }
  return null;
}

export function hiResPlayUrl(u: string): string {
  if (!u.includes("play-lh.googleusercontent.com")) return u;
  const base = u.replace(/=[sw]\d+(?:-h\d+)?(?:-[a-z0-9-]+)?$/i, "");
  return base + "=w1920";
}

function kebab(s: string): string {
  return normalizeName(s).replace(/\s+/g, "-");
}
function amountOf(name: string): number | null {
  const m = name.replace(/\s+/g, " ").match(/(\d{1,3}(?:[.,]\d{3})+|\d+)/);
  if (!m) return null;
  const n = parseInt(m[1].replace(/[.,]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let seagmNullStreak = 0;
let seagmBlocked = false;

async function fetchSeagm(url: string): Promise<{ html: string; blocked: boolean }> {
  try {
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
    if (r.status === 404) return { html: "", blocked: false };
    if (!r.ok) return { html: "", blocked: true };
    return { html: await r.text(), blocked: false };
  } catch {
    return { html: "", blocked: true };
  }
}

let catalogSlugs: string[] | null = null;

function stemTokens(s: string): string[] {
  return normalizeName(s).split(" ")
    .filter((t) => t && t !== "top" && t !== "up")
    .map((t) => (t.endsWith("s") && t.length > 3 ? t.slice(0, -1) : t));
}

async function loadCatalogSlugs(): Promise<string[] | null> {
  if (catalogSlugs) return catalogSlugs;
  const { html, blocked } = await fetchSeagm("https://www.seagm.com/en-us/direct-topup");
  if (blocked) {
    seagmNullStreak++;
    if (seagmNullStreak >= 8) seagmBlocked = true;
    return null;
  }
  if (!html) return null;
  seagmNullStreak = 0;
  catalogSlugs = [...new Set([...html.matchAll(/href="\/en-us\/([a-z0-9-]+)"/g)].map((m) => m[1]))];
  return catalogSlugs;
}

function catalogCandidates(slugs: string[], gameName: string): string[] {
  const gt = stemTokens(gameName);
  if (!gt.length) return [];
  const scored: Array<{ extra: number; slug: string }> = [];
  for (const slug of slugs) {
    const st = stemTokens(slug.replace(/-/g, " "));
    const hit = gt.filter((t) => st.includes(t)).length;
    if (hit === gt.length || (hit >= gt.length - 1 && st.includes(gt[0]) && gt.length >= 3)) {
      scored.push({ extra: st.length - hit, slug });
    }
  }
  scored.sort((a, b) => a.extra - b.extra);
  return scored.slice(0, 3).map((x) => x.slug);
}

async function seagmPageFor(gameId: number, gameName: string): Promise<string> {
  if (seagmBlocked) return "";
  let map: Record<string, string> = {};
  try { map = JSON.parse((await getSetting("seagm_pages")) || "{}") as Record<string, string>; } catch { map = {}; }
  const key = String(gameId);
  if (key in map) return map[key];
  let found = "";
  let sawContent = false;
  const slugs = await loadCatalogSlugs();
  if (slugs) {
    sawContent = true;
    for (const slug of catalogCandidates(slugs, gameName)) {
      const url = `https://www.seagm.com/en-us/${slug}`;
      const { html, blocked } = await fetchSeagm(url);
      if (html) {
        seagmNullStreak = 0;
        if (html.includes("icon_sku")) { found = url; break; }
      } else if (blocked) {
        seagmNullStreak++;
        if (seagmNullStreak >= 8) { seagmBlocked = true; return ""; }
      }
      await sleep(1200);
    }
  }
  if (!found && !seagmBlocked) {
    const k = kebab(gameName);
    for (const slug of [`${k}-top-up`, `${k}-diamonds-top-up`, `${k}-diamond-top-up`, `${k}-uc-top-up`, `${k}-direct-top-up`]) {
      const url = `https://www.seagm.com/en-us/${slug}`;
      const { html, blocked } = await fetchSeagm(url);
      if (html) {
        sawContent = true;
        seagmNullStreak = 0;
        if (html.includes("icon_sku")) { found = url; break; }
      } else if (blocked) {
        seagmNullStreak++;
        if (seagmNullStreak >= 8) { seagmBlocked = true; return ""; }
      }
      await sleep(1200);
    }
  }
  if (found || sawContent) {
    map[key] = found;
    await setSetting("seagm_pages", JSON.stringify(map));
  }
  return found;
}

export function pickIcon(icons: Map<number, string>, amount: number | null): string | undefined {
  if (!icons.size) return undefined;
  if (amount !== null) {
    const exact = icons.get(amount);
    if (exact) return exact;
    let best: number | null = null;
    let bestDiff = Infinity;
    for (const m of icons.keys()) {
      const d = Math.abs(Math.log(amount / m));
      if (d < bestDiff) { bestDiff = d; best = m; }
    }
    return best !== null ? icons.get(best) : undefined;
  }
  const min = Math.min(...icons.keys());
  return icons.get(min);
}

function parseSeagm(html: string): { icons: Map<number, string>; cover: string } {
  const icons = new Map<number, string>();
  const re = /https:\/\/seagm-media\.seagmcdn\.com\/icon_sku\/[\d-]+\.png/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const after = html.slice(m.index, m.index + 300);
    const alt = after.match(/alt="[^"]*?(\d[\d.,]*)\s*[A-Za-zÀ-ỹ]/);
    const sku = after.match(/class="sku">\s*<span>([^<]+)</);
    const n = (alt ? amountOf(alt[1]) : null) ?? (sku ? amountOf(sku[1]) : null);
    if (n !== null && !icons.has(n)) icons.set(n, m[0]);
  }
  const g = html.match(/https:\/\/seagm-media\.seagmcdn\.com\/game_400\/[\w.-]+/);
  return { icons, cover: g ? g[0] : "" };
}

export type EnrichState = SyncState & { covers: number; banners: number; genres: number; pkgIcons: number; descs: number };
const IDLE: EnrichState = { status: "idle", phase: "", done: 0, total: 0, games: 0, packages: 0, message: "", startedAt: 0, finishedAt: 0, covers: 0, banners: 0, genres: 0, pkgIcons: 0, descs: 0 };

export async function readEnrichState(): Promise<EnrichState> {
  try {
    const raw = await getSetting("enrich_state");
    if (raw) return { ...IDLE, ...(JSON.parse(raw) as Partial<EnrichState>) };
  } catch { /* trạng thái hỏng thì coi như idle */ }
  return IDLE;
}
async function writeEnrichState(s: EnrichState): Promise<void> {
  await setSetting("enrich_state", JSON.stringify(s));
}

async function coverIsRounded(url: string, verifiedSquare: Set<string>): Promise<boolean> {
  if (!url || url.startsWith("/uploads/") || verifiedSquare.has(url)) return false;
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36" }, signal: AbortSignal.timeout(12000) });
    if (!r.ok) return false;
    const buf = Buffer.from(await r.arrayBuffer());
    const sharp = (await import("sharp")).default;
    const img = sharp(buf).ensureAlpha();
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    const w = info.width, h = info.height, ch = info.channels;
    const alphaAt = (x: number, y: number) => data[(y * w + x) * ch + (ch - 1)];
    const inset = Math.max(2, Math.floor(Math.min(w, h) * 0.04));
    const corners = [alphaAt(inset, inset), alphaAt(w - 1 - inset, inset), alphaAt(inset, h - 1 - inset), alphaAt(w - 1 - inset, h - 1 - inset)];
    const rounded = corners.some((a) => a < 110);
    if (!rounded) verifiedSquare.add(url);
    return rounded;
  } catch {
    return false;
  }
}

export async function runEnrichment(): Promise<EnrichState> {
  const cur = await readEnrichState();
  if (cur.status === "running" && Date.now() - cur.startedAt < 30 * 60 * 1000) return cur;
  seagmNullStreak = 0;
  seagmBlocked = false;
  catalogSlugs = null;
  const cfg0 = await getSettings();
  const verifiedSquare = new Set<string>();
  try { for (const u of JSON.parse(cfg0.square_checked || "[]") as string[]) verifiedSquare.add(u); } catch { /* cache hỏng thì kiểm lại từ đầu */ }
  const state: EnrichState = { ...IDLE, status: "running", phase: "Đang quét game còn thiếu dữ liệu...", startedAt: Date.now() };
  await writeEnrichState(state);
  try {
    const { reconcilePackageImages } = await import("./pkg-images");
    const rec = await reconcilePackageImages();
    if (rec.filled) state.message = `Đã mượn ${rec.filled} ảnh gói giữa các nguồn (${rec.games} game).`;
  } catch { /* mượn ảnh lỗi thì bỏ qua, enrich vẫn chạy tiếp */ }
  let lastWrite = 0;
  const progress = async (phase: string) => {
    state.phase = phase;
    if (Date.now() - lastWrite > 500) { lastWrite = Date.now(); await writeEnrichState({ ...state }); }
  };
  try {
    const games = await prisma.game.findMany({
      where: { active: true },
      include: { packages: { where: { active: true }, select: { id: true, name: true, imageUrl: true } } },
      orderBy: { soldCount: "desc" },
      take: 400,
    });
    const todo = games.filter((g) => !g.cover || !g.genre || !g.description || !g.bannerUrl || g.packages.some((p) => !p.imageUrl)
      || (g.cover && g.cover.includes("mzstatic.com"))
      || (g.cover && !g.cover.startsWith("/uploads/") && !g.cover.includes("seagmcdn.com"))
      || (g.bannerUrl && g.bannerUrl.includes("play-lh.googleusercontent.com") && !g.bannerUrl.includes("=w1920")));
    state.total = todo.length;
    for (const g of todo) {
      state.done++;
      await progress(`Đang bổ sung: ${g.name} (${state.done}/${state.total})`);
      const data: { cover?: string; genre?: string; bannerUrl?: string; description?: string } = {};
      const coverIsItunesIcon = !!g.cover && g.cover.includes("mzstatic.com");
      const coverRounded = coverIsItunesIcon ? false : await coverIsRounded(g.cover, verifiedSquare);
      const imageless = g.packages.filter((p) => !p.imageUrl);
      let seagm: { icons: Map<number, string>; cover: string } | null = null;
      if (imageless.length > 0 || !g.cover || coverIsItunesIcon || coverRounded) {
        const page = await seagmPageFor(g.id, g.name);
        if (page) {
          const html = await fetchText(page);
          if (html) seagm = parseSeagm(html);
        }
      }
      if (seagm?.cover && (!g.cover || coverIsItunesIcon || coverRounded)) { data.cover = seagm.cover; state.covers++; }
      if (!g.genre || !g.description || (!g.cover && !data.cover) || (coverIsItunesIcon && !data.cover)) {
        const hit = await itunesLookup(g.name);
        if (hit) {
          if (!g.cover && !data.cover && hit.cover) { data.cover = hit.cover; state.covers++; }
          if (!g.genre && hit.genre) { data.genre = hit.genre; state.genres++; }
          if (!g.description && hit.description) { data.description = hit.description; state.descs++; }
        }
      }
      if (coverIsItunesIcon && !data.cover && g.cover.includes("512x512bb")) {
        data.cover = g.cover.replace("512x512bb", "1024x1024bb");
      }
      if (!g.bannerUrl || !g.genre || !g.description) {
        const hit = await playLookup(g.name);
        if (hit) {
          if (!g.bannerUrl && hit.banner) { data.bannerUrl = hit.banner; state.banners++; }
          if (!g.genre && !data.genre && hit.genre) { data.genre = hit.genre; state.genres++; }
          if (!g.description && !data.description && hit.description) { data.description = hit.description; state.descs++; }
        }
      }
      if (g.bannerUrl && g.bannerUrl.includes("play-lh.googleusercontent.com") && !g.bannerUrl.includes("=w1920")) {
        data.bannerUrl = hiResPlayUrl(g.bannerUrl);
      }
      if (seagm && imageless.length > 0) {
        for (const p of imageless) {
          const icon = pickIcon(seagm.icons, amountOf(p.name));
          if (icon) {
            await prisma.package.update({ where: { id: p.id }, data: { imageUrl: icon } });
            state.pkgIcons++;
          }
        }
      }
      const fc = data.cover ?? g.cover;
      if (fc && fc.startsWith("http") && !fc.includes("seagmcdn.com")) {
        const local = await squareRemoteCover(g.id, fc);
        if (local) { data.cover = local; state.covers++; }
      }
      if (Object.keys(data).length > 0) {
        await prisma.game.update({ where: { id: g.id }, data });
      }
    }
    await setSetting("square_checked", JSON.stringify([...verifiedSquare].slice(-1500)));
    state.status = "done";
    state.phase = "Hoàn tất";
    state.finishedAt = Date.now();
    state.message = `Bổ sung xong: ${state.covers} bìa, ${state.banners} banner, ${state.genres} thể loại, ${state.pkgIcons} icon gói, ${state.descs} mô tả.`;
  } catch (e) {
    state.status = "error";
    state.phase = "Lỗi";
    state.finishedAt = Date.now();
    state.message = e instanceof Error ? e.message : "Lỗi không rõ khi bổ sung dữ liệu.";
  }
  await writeEnrichState(state);
  return state;
}
