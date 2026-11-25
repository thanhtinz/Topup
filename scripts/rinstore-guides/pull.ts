import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const BASE = "https://rinstore247.com";
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Step = { text: string; image: string };
type Guide = { slug: string; name: string; delivery: string; uidSteps: Step[]; noticeSteps: Step[]; noticeTitle: string };

async function fetchText(url: string): Promise<string> {
  try {
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) });
    return r.ok ? await r.text() : "";
  } catch { return ""; }
}

function rscPayload(html: string): string {
  const parts: string[] = [];
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/gs)) {
    try { parts.push(JSON.parse(m[1]) as string); } catch { }
  }
  return parts.join("\n");
}

function rscRow(payload: string, id: string): string {
  const m = new RegExp(`(?:^|\\n)${id}:T[0-9a-f]+,([\\s\\S]*?)(?=\\n[0-9a-f]+:|$)`, "m").exec(payload);
  return m ? m[1].trim() : "";
}

function extractObject(text: string, from: number): Record<string, unknown> | null {
  const start = text.indexOf("{", from);
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { try { return JSON.parse(text.slice(start, i + 1)) as Record<string, unknown>; } catch { return null; } } }
  }
  return null;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function htmlToSteps(html: string): { title: string; steps: Step[] } {
  const steps: Step[] = [];
  let title = "";
  let cur: Step | null = null;
  const re = /<(h3|p)\b[^>]*>([\s\S]*?)<\/\1>|<img\b[^>]*?src="([^"]+)"/gi;
  for (const m of html.matchAll(re)) {
    if (m[3]) { if (cur && !cur.image) cur.image = m[3]; continue; }
    const tag = (m[1] || "").toLowerCase();
    const text = stripTags(m[2] || "");
    if (!text) continue;
    const stepHead = /^(bước|step)\s*\d+\s*[:.]/i.test(text);
    if (tag === "h3" || stepHead) {
      const clean = text.replace(/^(bước|step)\s*\d+\s*[:.]\s*/i, "").trim();
      cur = { text: clean || text, image: "" };
      steps.push(cur);
    } else if (cur) {
      cur.text = cur.text ? `${cur.text} — ${text}` : text;
    } else if (!title) {
      title = text;
    }
  }
  return { title, steps: steps.filter((s) => s.text) };
}

function uidSection(html: string): string {
  const heads = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)];
  for (let i = 0; i < heads.length; i++) {
    if (/uid/i.test(stripTags(heads[i][1]))) {
      const from = (heads[i].index ?? 0) + heads[i][0].length;
      const to = i + 1 < heads.length ? (heads[i + 1].index ?? html.length) : html.length;
      return html.slice(from, to);
    }
  }
  return "";
}

async function pullProduct(slug: string): Promise<Guide | null> {
  const html = await fetchText(`${BASE}/product/${slug}`);
  if (!html) return null;
  const payload = rscPayload(html);
  const pIdx = payload.indexOf('"product":');
  if (pIdx < 0) return null;
  const product = extractObject(payload, pIdx + '"product":'.length);
  if (!product) return null;
  const name = String(product.baseName ?? product.name ?? slug);
  const delivery = String(product.delivery ?? "");
  let uidSteps: Step[] = [];
  let longDesc = typeof product.longDescription === "string" ? product.longDescription : "";
  if (longDesc.startsWith("$")) longDesc = rscRow(payload, longDesc.slice(1));
  if (longDesc) {
    const sec = uidSection(longDesc);
    if (sec) uidSteps = htmlToSteps(sec).steps;
  }
  let noticeSteps: Step[] = [];
  let noticeTitle = "";
  const notice = product.notice as { info?: Record<string, string>; guide?: Record<string, string> } | null;
  if (notice && typeof notice === "object") {
    for (const key of ["guide", "info"] as const) {
      const loc = notice[key];
      if (!loc) continue;
      for (const lang of ["vi", "en"]) {
        const v = loc[lang];
        if (typeof v !== "string" || !v) continue;
        const htmlBlock = v.startsWith("$") ? rscRow(payload, v.slice(1)) : v;
        if (htmlBlock) {
          const parsed = htmlToSteps(htmlBlock);
          if (parsed.steps.length) { noticeSteps = parsed.steps; noticeTitle = parsed.title; break; }
        }
      }
      if (noticeSteps.length) break;
    }
  }
  if (!uidSteps.length && !noticeSteps.length) return null;
  return { slug, name, delivery, uidSteps, noticeSteps, noticeTitle };
}

async function discoverSlugs(): Promise<string[]> {
  const seeds = ["/", "/catalog", "/catalog/gacha", "/catalog/mobile", "/catalog/pc-game", "/catalog/gift-card", "/catalog/reroll", "/catalog/subscription", "/catalog/steam-wallet", "/newly-added"];
  const slugs = new Set<string>();
  for (const path of seeds) {
    const html = await fetchText(BASE + path);
    for (const m of html.matchAll(/href="\/product\/([a-z0-9-]+)"/g)) slugs.add(m[1]);
    await sleep(200);
  }
  return [...slugs];
}

async function main() {
  const apply = process.argv.includes("--apply");
  const force = process.argv.includes("--force");
  const slugs = await discoverSlugs();
  console.log(`Tìm thấy ${slugs.length} sản phẩm trên Rinstore, bắt đầu lấy hướng dẫn...`);
  const guides: Guide[] = [];
  for (const slug of slugs) {
    const g = await pullProduct(slug);
    if (g) {
      guides.push(g);
      console.log(`  ${slug}: UID ${g.uidSteps.length} bước · notice ${g.noticeSteps.length} bước`);
    }
    await sleep(250);
  }
  const outDir = join(process.cwd(), "scripts/rinstore-guides/out");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "guides.json"), JSON.stringify(guides, null, 2));
  const md = guides.map((g) => {
    const block = (label: string, steps: Step[]) => steps.length ? [`### ${label}`, ...steps.map((s, i) => `${i + 1}. ${s.text}${s.image ? `\n   Ảnh: ${s.image}` : ""}`)] : [];
    return [`## ${g.name} (${g.slug}) — delivery: ${g.delivery}`, ...block("Hướng dẫn UID", g.uidSteps), ...block(`Khối guide đính kèm${g.noticeTitle ? `: ${g.noticeTitle}` : ""}`, g.noticeSteps), ""].join("\n");
  }).join("\n");
  writeFileSync(join(outDir, "guides.md"), md);
  console.log(`Xong: ${guides.length} game có hướng dẫn. Đã ghi out/guides.json + out/guides.md`);

  if (apply) {
    const { prisma } = await import("../../src/lib/db");
    const { parseGameName } = await import("../../src/lib/providers");
    const norm = (s: string) => parseGameName(s).base.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
    const games = await prisma.game.findMany({ select: { id: true, name: true, slug: true, uidGuideJson: true } });
    let applied = 0;
    for (const g of guides) {
      const steps = g.uidSteps.length ? g.uidSteps : [];
      if (!steps.length) continue;
      const target = games.find((x) => norm(x.name) === norm(g.name));
      if (!target) { console.log(`  Bỏ qua (không có game khớp): ${g.name}`); continue; }
      const has = Array.isArray(target.uidGuideJson) && (target.uidGuideJson as unknown[]).length > 0;
      if (has && !force) { console.log(`  Đã có sẵn, giữ nguyên: ${target.name}`); continue; }
      const dir = join(process.cwd(), "public/uploads/uid-guides", target.slug);
      const finalSteps: Step[] = [];
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        let image = "";
        if (s.image) {
          try {
            const url = s.image.startsWith("http") ? s.image : BASE + s.image;
            const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
            if (r.ok) {
              if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
              const ext = (url.split(".").pop() || "png").split("?")[0].toLowerCase();
              const file = `${i + 1}.${["png", "jpg", "jpeg", "webp", "gif"].includes(ext) ? ext : "png"}`;
              writeFileSync(join(dir, file), Buffer.from(await r.arrayBuffer()));
              image = `/uploads/uid-guides/${target.slug}/${file}`;
            }
          } catch { /* ảnh lỗi thì để trống */ }
        }
        finalSteps.push({ text: s.text, image });
      }
      await prisma.game.update({ where: { id: target.id }, data: { uidGuideJson: finalSteps } });
      applied++;
      console.log(`  Đã áp: ${target.name} (${finalSteps.length} bước)`);
    }
    console.log(`Áp xong ${applied} game.`);
    await prisma.$disconnect();
  }
}

main();
