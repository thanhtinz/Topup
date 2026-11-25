import { matchImage } from "../src/lib/pkg-images";

type Row = { id: number; gameId: number; provider: string; name: string; region: string; method: string; imageUrl: string | null };
const T = (name: string): Row => ({ id: 1, gameId: 1, provider: "FZR", name, region: "", method: "UID", imageUrl: null });
const D = (name: string, url: string): Row => ({ id: 2, gameId: 1, provider: "ERIS", name, region: "", method: "UID", imageUrl: url });

let fail = 0;
function eq(label: string, got: string | null, want: string | null) {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}: got=${got} want=${want}`);
}

eq("exact", matchImage(T("60 Genesis Crystals"), [D("60 Genesis Crystals", "a.png")]), "a.png");
eq("so it/so nhieu", matchImage(T("60 Oneiric Shard"), [D("60 Oneiric Shards", "b.png")]), "b.png");
eq("PGR viet tat RC", matchImage(T("(iOS) 5 Rainbow Cards"), [D("IOS - 5 RC", "c.png")]), "c.png");
eq("PGR Andr ~ Android", matchImage(T("(Android) 28 Rainbow Cards"), [D("Andr - 28 RC", "d.png")]), "d.png");
eq("khac menh gia (300 vs 300+30)", matchImage(T("300 + 30 Oneiric Shard"), [D("300 Oneiric Shards", "e.png")]), null);
eq("khac so luong", matchImage(T("61 Gems"), [D("60++ Gems", "f.png")]), null);
eq("khong so thi khong muon", matchImage(T("Chronicles of the Realms"), [D("Epic of the Realms", "g.png")]), null);
eq("Welkin Moon exact", matchImage(T("Blessing of the Welkin Moon"), [D("Blessing of the Welkin Moon", "h.png")]), "h.png");
console.log(fail === 0 ? "ALL PASS" : `${fail} FAIL`);
process.exit(fail ? 1 : 0);
