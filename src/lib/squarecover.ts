import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36" };

function isEmptyPx(r: number, g: number, b: number, a: number): boolean {
  return a < 110 || (r >= 248 && g >= 248 && b >= 248);
}

export async function cornersEmpty(buf: Buffer): Promise<boolean> {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, ch = info.channels;
  const inset = Math.max(2, Math.floor(Math.min(w, h) * 0.04));
  const pts: Array<[number, number]> = [[inset, inset], [w - 1 - inset, inset], [inset, h - 1 - inset], [w - 1 - inset, h - 1 - inset]];
  return pts.some(([x, y]) => {
    const i = (y * w + x) * ch;
    return isEmptyPx(data[i], data[i + 1], data[i + 2], data[i + 3]);
  });
}

export async function makeSquareCover(buf: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, ch = info.channels;
  const total = w * h;
  const isEmpty = (idx: number) => {
    const i = idx * ch;
    return isEmptyPx(data[i], data[i + 1], data[i + 2], data[i + 3]);
  };
  const visited = new Uint8Array(total);
  const stack: number[] = [];
  const seed = (x: number, y: number) => {
    const idx = y * w + x;
    if (!visited[idx] && isEmpty(idx)) { visited[idx] = 1; stack.push(idx); }
  };
  seed(0, 0); seed(w - 1, 0); seed(0, h - 1); seed(w - 1, h - 1);
  while (stack.length) {
    const idx = stack.pop()!;
    const x = idx % w, y = (idx / w) | 0;
    if (x > 0) { const n = idx - 1; if (!visited[n] && isEmpty(n)) { visited[n] = 1; stack.push(n); } }
    if (x < w - 1) { const n = idx + 1; if (!visited[n] && isEmpty(n)) { visited[n] = 1; stack.push(n); } }
    if (y > 0) { const n = idx - w; if (!visited[n] && isEmpty(n)) { visited[n] = 1; stack.push(n); } }
    if (y < h - 1) { const n = idx + w; if (!visited[n] && isEmpty(n)) { visited[n] = 1; stack.push(n); } }
  }
  let masked = 0;
  const out = Buffer.from(data);
  for (let idx = 0; idx < total; idx++) {
    if (visited[idx]) { out[idx * ch + 3] = 0; masked++; }
  }
  if (!masked || masked > total * 0.35) return buf;
  const cleared = await sharp(out, { raw: { width: w, height: h, channels: ch } }).png().toBuffer();
  const bleed = await sharp(cleared).blur(Math.max(8, Math.round(Math.min(w, h) * 0.06))).png().toBuffer();
  const stats = await sharp(cleared).stats();
  const bg = {
    r: Math.round(stats.channels[0].mean),
    g: Math.round(stats.channels[1].mean),
    b: Math.round(stats.channels[2].mean),
  };
  return sharp(bleed).composite([{ input: cleared }]).flatten({ background: bg }).jpeg({ quality: 88 }).toBuffer();
}

export async function squareRemoteCover(gameId: number, url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (!(await cornersEmpty(buf))) return null;
    const squared = await makeSquareCover(buf);
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const name = `sq-cover-${gameId}.jpg`;
    await writeFile(path.join(dir, name), squared);
    return `/uploads/${name}`;
  } catch {
    return null;
  }
}
