#!/usr/bin/env python3
"""Dò thử slug SEAGM cho các game đang thiếu toàn bộ ảnh gói (ngoài danh mục
direct-topup 89 slug đã quét): thử các mẫu slug phổ biến, trang nào có
icon_sku thì parse + khớp mệnh giá như harvest, ghi /tmp/seagm-probe.sql.
"""
import json
import math
import re
import subprocess
import time

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

GAMES = {
    "Legend of the Phoenix": ["legend-of-the-phoenix-top-up", "legend-of-the-phoenix"],
    "Solo Leveling: Arise": ["solo-leveling-arise-top-up", "solo-leveling-arise"],
    "Bleach: Soul Resonance": ["bleach-soul-resonance-top-up", "bleach-soul-resonance"],
    "Etheria Restart": ["etheria-restart-top-up", "etheria-restart"],
    "Ludus Strategy PVP": ["ludus-strategy-pvp-top-up", "ludus-top-up"],
    "Legend of Neverland": ["the-legend-of-neverland-top-up", "legend-of-neverland-top-up", "the-legend-of-neverland"],
    "Legend of Neverland (NAEU)": ["the-legend-of-neverland-top-up", "legend-of-neverland-top-up"],
    "FRAG Pro Shooter": ["frag-pro-shooter-top-up", "frag-top-up"],
    "Devil May Cry: Peak of Combat": ["devil-may-cry-peak-of-combat-top-up", "dmc-peak-of-combat-top-up"],
    "Knives Out": ["knives-out-top-up", "knives-out"],
    "Dragonheir: Silent Gods": ["dragonheir-silent-gods-top-up", "dragonheir-top-up"],
    "Dunk City Dynasty": ["dunk-city-dynasty-top-up", "dunk-city-dynasty"],
    "Racing Master": ["racing-master-top-up", "racing-master"],
    "Ghost Story: Love Destiny": ["ghost-story-love-destiny-top-up", "ghost-story-top-up"],
    "Bullet Echo": ["bullet-echo-top-up", "bullet-echo"],
    "Pixel Gun 3D": ["pixel-gun-3d-top-up", "pixel-gun-3d"],
    "CATS: Crash Arena Turbo Stars": ["cats-crash-arena-turbo-stars-top-up", "cats-top-up"],
    "Sword of Justice": ["sword-of-justice-top-up", "sword-of-justice"],
    "Haikyu!! Fly High": ["haikyu-fly-high-top-up", "haikyu-fly-high"],
    "Garena Delta Force": ["delta-force-top-up", "garena-delta-force-top-up", "delta-force-mobile-top-up"],
    "TFT Mobile": ["teamfight-tactics-mobile-top-up", "tft-mobile-top-up"],
    "Garena Undawn": ["undawn-top-up", "garena-undawn-top-up"],
}


def fetch(url: str) -> str:
    r = subprocess.run(["curl", "-sL", "--max-time", "30", "-A", UA, url],
                       capture_output=True, text=True)
    return r.stdout or ""


def amount_of(name: str) -> int | None:
    m = re.search(r"(\d{1,3}(?:[.,]\d{3})+|\d+)", name)
    if not m:
        return None
    n = int(m.group(1).replace(".", "").replace(",", ""))
    return n if n > 0 else None


def parse_icons(html: str) -> list[tuple[int | None, str]]:
    out = []
    for m in re.finditer(r'<img[^>]+src="(https://seagm-media\.seagmcdn\.com/icon_sku/[^"]+)"[^>]*alt="([^"]*)"', html):
        out.append((amount_of(m.group(2)), m.group(1)))
    if not out:
        for m in re.finditer(r'(https://seagm-media\.seagmcdn\.com/icon_sku/[^\s"\\]+)', html):
            out.append((None, m.group(1)))
    seen, res = set(), []
    for amt, url in out:
        if url not in seen:
            seen.add(url)
            res.append((amt, url))
    return res


def pick(icons: list[tuple[int | None, str]], amount: int | None) -> str | None:
    numbered = [(a, u) for a, u in icons if a]
    if not icons:
        return None
    if amount and numbered:
        for a, u in numbered:
            if a == amount:
                return u
        return min(numbered, key=lambda x: abs(math.log(amount / x[0])))[1]
    if numbered:
        return min(numbered)[1]
    return icons[0][1]


def main() -> int:
    rows = json.load(open("/tmp/all-pkgs.json"))
    missing: dict[str, list[dict]] = {}
    for r in rows:
        if not r["img"] and r["gname"] in GAMES:
            missing.setdefault(r["gname"], []).append(r)
    updates: list[tuple[int, str]] = []
    report = {}
    for gname, slugs in GAMES.items():
        pkgs = missing.get(gname)
        if not pkgs:
            report[gname] = "no-missing"
            continue
        found_url, icons = "", []
        for slug in slugs:
            html = fetch(f"https://www.seagm.com/en-us/{slug}")
            icons = parse_icons(html)
            if icons:
                found_url = slug
                break
            time.sleep(1)
        if not icons:
            report[gname] = "no-seagm-page"
            continue
        n = 0
        for p in pkgs:
            icon = pick(icons, amount_of(p["pname"]))
            if icon:
                updates.append((p["pid"], icon))
                n += 1
        report[gname] = f"{found_url}: icons={len(icons)} filled={n}/{len(pkgs)}"
        time.sleep(1)
    sql = "\n".join(f"UPDATE \"Package\" SET \"imageUrl\" = '{u}' WHERE id = {pid} AND \"imageUrl\" IS NULL;"
                    for pid, u in updates)
    open("/tmp/seagm-probe.sql", "w").write(sql + "\n")
    print("updates:", len(updates))
    for k, v in report.items():
        print(f"  {k}: {v}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
