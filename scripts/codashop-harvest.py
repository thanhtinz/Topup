#!/usr/bin/env python3
"""Thu ảnh gói từ trang Codashop render phía server bằng curl: mỗi thẻ gói có
capture-custom-sku-name + <img srcset> ngay trong HTML. Thử slug (kebab tên
game + biến thể riêng) qua các khu vực tới khi gặp trang có gói kèm ảnh, khớp
mệnh giá/tên vào gói còn thiếu ảnh của mình. Đọc /tmp/zero-games.json (danh
sách game chưa có ảnh nào) + /tmp/all-pkgs.json, ghi /tmp/codashop-harvest.sql
và in báo cáo từng game.
"""
import json
import math
import re
import subprocess
import time
import unicodedata

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
REGIONS = ["vi-vn", "en-in", "en-bd", "en-pk", "en-kh", "en-mm", "pt-br",
           "es-mx", "tr-tr", "en-eg", "en-ng", "en-ke", "en-au", "en-gb",
           "en-ca", "en-ph", "en-us", "en-sg", "id-id", "en-my", "th-th"]

SLUG_OVERRIDES = {
    "Call of Duty Mobile - Activision": ["call-of-duty-mobile"],
    "Mobile Legends (United States)": ["mobile-legends"],
    "Legends of Runeterra (United States)": ["legends-of-runeterra"],
    "Undawn Global": ["undawn"],
    "Delta Force": ["delta-force"],
    "Garena Speed Drifters": ["garena-speed-drifters", "speed-drifters"],
    "Arknight: Endfield": ["arknights-endfield"],
    "PUBG: New State": ["new-state-mobile", "pubg-new-state"],
    "The Ants: Underground Kingdom": ["the-ants-underground-kingdom", "the-ants"],
    "Devil May Cry: Peak of Combat": ["devil-may-cry-peak-of-combat"],
    "Ragnarok M: Eternal Love": ["ragnarok-m-eternal-love", "ragnarok-mobile-eternal-love"],
    "Ragnarok X: Next Generation": ["ragnarok-x-next-generation"],
    "MU ORIGIN 3 Asia": ["mu-origin-3"],
    "Civilization: Eras & Allies": ["civilization-eras-and-allies"],
    "Sword of Fire and Ice": ["sword-of-fire-and-ice"],
    "Legacy of Discord - FuriousWings": ["legacy-of-discord"],
    "Dynasty Heroes: Legend Samkok": ["dynasty-heroes-legend-samkok"],
    "Starfall Fantasy: Neverland": ["starfall-fantasy-neverland"],
    "Arena Breakout: Infinite": ["arena-breakout-infinite"],
    "T3 Arena": ["t3-arena"],
    "8 Ball Pool": ["8-ball-pool"],
}


def kebab(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\([^)]*\)", "", s)
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s)).strip("-")


def fetch(url: str) -> str:
    r = subprocess.run(["curl", "-sL", "--max-time", "30", "-A", UA, url],
                       capture_output=True, text=True)
    return r.stdout or ""


def parse_skus(html: str) -> list[tuple[str, str]]:
    out = []
    for m in re.finditer(r'capture-custom-sku-name="([^"]+)"', html):
        name = m.group(1)
        img = re.search(r'<img[^>]+srcset="(https://cdn1\.codashop\.com/[^"\s]+)', html[m.end():m.end() + 3000])
        if img:
            out.append((name, img.group(1)))
    return out


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return " ".join(re.sub(r"[^a-z0-9 ]", " ", s.lower()).split())


def amount_of(name: str) -> int | None:
    m = re.search(r"(\d{1,3}(?:[.,]\d{3})+|\d+)", name)
    if not m:
        return None
    n = int(m.group(1).replace(".", "").replace(",", ""))
    return n if n > 0 else None


def unit_of(name: str) -> str:
    m = re.search(r"(?:\d{1,3}(?:[.,]\d{3})+|\d+)\s*([a-z]+)", name.lower())
    return m.group(1) if m else ""


def match_icon(skus: list[tuple[str, str]], pname: str) -> str | None:
    pn = norm(pname)
    by_name = {norm(n): u for n, u in skus}
    if pn in by_name:
        return by_name[pn]
    amt = amount_of(pname)
    if amt is None:
        return None
    unit = unit_of(pname)
    pool = [(amount_of(n), u) for n, u in skus
            if amount_of(n) and (not unit or unit_of(n) == unit)]
    if not pool:
        pool = [(amount_of(n), u) for n, u in skus if amount_of(n)]
    if not pool:
        return None
    for a, u in pool:
        if a == amt:
            return u
    return min(pool, key=lambda x: abs(math.log(amt / x[0])))[1]


def main() -> int:
    zero = json.load(open("/tmp/zero-games.json"))
    rows = json.load(open("/tmp/all-pkgs.json"))
    missing: dict[str, list[dict]] = {}
    for r in rows:
        if not r["img"]:
            missing.setdefault(r["gname"], []).append(r)
    updates: list[tuple[int, str]] = []
    report = {}
    for gname in zero:
        pkgs = missing.get(gname, [])
        if not pkgs:
            continue
        slugs = SLUG_OVERRIDES.get(gname, []) + [kebab(gname), kebab(gname) + "-top-up"]
        skus: list[tuple[str, str]] = []
        used = ""
        for slug in dict.fromkeys(slugs):
            for region in REGIONS:
                html = fetch(f"https://www.codashop.com/{region}/{slug}")
                skus = parse_skus(html)
                if skus:
                    used = f"{region}/{slug}"
                    break
                time.sleep(0.4)
            if skus:
                break
        if not skus:
            report[gname] = "no-codashop-images"
            print(f"  {gname}: no-codashop-images", flush=True)
            continue
        n = 0
        with open("/tmp/codashop-harvest2.sql", "a") as f:
            for p in pkgs:
                icon = match_icon(skus, p["pname"])
                if icon:
                    updates.append((p["pid"], icon))
                    f.write(f"UPDATE \"Package\" SET \"imageUrl\" = '{icon}' WHERE id = {p['pid']} AND \"imageUrl\" IS NULL;\n")
                    n += 1
        report[gname] = f"{used}: skus={len(skus)} filled={n}/{len(pkgs)}"
        print(f"  {gname}: {report[gname]}", flush=True)
    print("updates:", len(updates), "| games filled:", sum(1 for v in report.values() if "filled" in v))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
