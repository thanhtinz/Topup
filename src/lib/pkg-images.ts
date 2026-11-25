import { prisma } from "./db";


type PkgRow = {
  id: number;
  gameId: number;
  provider: string;
  name: string;
  region: string;
  method: string;
  imageUrl: string | null;
};

function sing(w: string): string {
  return w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w;
}

function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+ ]/g, " ").replace(/\s+/g, " ").trim().split(" ").map(sing).join(" ");
}

function numbersOf(s: string): string {
  return (s.match(/\d+/g) ?? []).join(",");
}

function tokenList(s: string): string[] {
  return normName(s).split(" ").filter((w) => w && !/^\d+$/.test(w) && w !== "+");
}

function expandedTokens(s: string): Set<string> {
  const list = tokenList(s);
  const set = new Set(list);
  for (let n = 2; n <= 3; n++) {
    for (let i = 0; i + n <= list.length; i++) {
      set.add(list.slice(i, i + n).map((w) => w.charAt(0)).join(""));
    }
  }
  return set;
}

function tokenMatch(a: string, b: string): boolean {
  if (a === b) return true;
  return (a.length >= 3 && b.startsWith(a)) || (b.length >= 3 && a.startsWith(b));
}

function coveredAll(small: Set<string>, big: Set<string>): boolean {
  if (!small.size) return false;
  for (const a of small) {
    let ok = false;
    for (const b of big) if (tokenMatch(a, b)) { ok = true; break; }
    if (!ok) return false;
  }
  return true;
}

function pickImage(cands: PkgRow[], target: PkgRow): string | null {
  const scored = cands.map((c) => ({
    url: c.imageUrl as string,
    score: (c.method === target.method ? 2 : 0) + (c.region === target.region ? 1 : 0),
  }));
  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter((s) => s.score === scored[0].score);
  const freq = new Map<string, number>();
  for (const s of top) freq.set(s.url, (freq.get(s.url) ?? 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export function matchImage(target: PkgRow, donors: PkgRow[]): string | null {
  const tn = normName(target.name);
  const exact = donors.filter((d) => normName(d.name) === tn);
  if (exact.length) return pickImage(exact, target);
  const tNums = numbersOf(target.name);
  if (!tNums) return null;
  const tTok = expandedTokens(target.name);
  const fuzzy = donors.filter((d) => {
    if (numbersOf(d.name) !== tNums) return false;
    const dTok = expandedTokens(d.name);
    const [small, big] = tTok.size <= dTok.size ? [tTok, dTok] : [dTok, tTok];
    return coveredAll(small, big);
  });
  if (fuzzy.length) return pickImage(fuzzy, target);
  return null;
}

export async function reconcilePackageImages(): Promise<{ filled: number; games: number }> {
  const rows = (await prisma.package.findMany({
    where: { active: true },
    select: { id: true, gameId: true, provider: true, name: true, region: true, method: true, imageUrl: true },
  })) as PkgRow[];
  const byGame = new Map<number, PkgRow[]>();
  for (const r of rows) {
    const arr = byGame.get(r.gameId) ?? [];
    arr.push(r);
    byGame.set(r.gameId, arr);
  }
  let filled = 0;
  let games = 0;
  for (const pkgs of byGame.values()) {
    const donors = pkgs.filter((p) => p.imageUrl && p.imageUrl.trim());
    const needy = pkgs.filter((p) => !p.imageUrl || !p.imageUrl.trim());
    if (!donors.length || !needy.length) continue;
    const providers = new Set(pkgs.map((p) => p.provider));
    if (providers.size < 2) continue;
    let gameFilled = 0;
    for (const t of needy) {
      const crossDonors = donors.filter((d) => d.provider !== t.provider);
      if (!crossDonors.length) continue;
      const url = matchImage(t, crossDonors);
      if (!url) continue;
      await prisma.package.update({ where: { id: t.id }, data: { imageUrl: url } });
      gameFilled++;
    }
    if (gameFilled) {
      filled += gameFilled;
      games++;
    }
  }
  return { filled, games };
}
