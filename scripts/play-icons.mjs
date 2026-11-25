import gplay from "google-play-scraper";
import { writeFileSync } from "node:fs";

const NAMES = ["Puzzles & Survival", "Ragnarok Idle Adventure Plus", "Ghost Story: Love Destiny",
  "Crossfire: Legend", "Fashion Dream", "Astral Guardians: Cyber Fantasy", "Conquer Online",
  "EVE Echoes", "Extraordinary Ones", "Hero Clash", "Kingshot", "Isekai Feast: Tales of Recipes",
  "Heaven Burns Red", "Jade Dynasty: New Fantasy", "MU ORIGIN 3 Asia", "Journey Renewed: Fate Fantasy",
  "T3 Arena", "Mirage: Perfect Skyline", "X-Clash: Survival Challenge", "Mobile Legends: Adventure"];

const norm = (s) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const out = {};
for (const name of NAMES) {
  const target = norm(name);
  let icon = "";
  for (const country of ["us", "vn", "sg", "th", "ph", "id", "my", "kr", "jp", "tw", "hk"]) {
    try {
      const res = await gplay.search({ term: name, num: 5, country, lang: "en" });
      const hit = res.find((x) => norm(x.title) === target);
      if (hit) {
        const full = await gplay.app({ appId: hit.appId, country, lang: "en" }).catch(() => null);
        if (full?.icon) { icon = full.icon; break; }
      }
    } catch { }
    await sleep(300);
  }
  out[name] = icon;
  console.log(icon ? `OK  ${name} -> ${icon.slice(0, 80)}` : `--  ${name}`);
}
writeFileSync("/tmp/play-icons.json", JSON.stringify(out, null, 1));
console.log("DONE", Object.values(out).filter(Boolean).length, "/", NAMES.length);
