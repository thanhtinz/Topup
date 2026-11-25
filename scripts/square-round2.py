#!/usr/bin/env python3
"""Vòng 2 cho bìa bo góc/ép vuông mà SteamGridDB không có ảnh vuông:
lấy bìa game_400 (vuông full viền) từ trang SEAGM của game, kiểm 4 góc
trước khi nhận. Ghi /tmp/square-fix2.json.
"""
import io
import json
import re
import subprocess
import time
import unicodedata

from PIL import Image

FAILED = ["Puzzles & Survival", "Ragnarok Idle Adventure Plus", "Ghost Story: Love Destiny",
          "Onmyoji Arena", "Crossfire: Legend", "Fashion Dream", "Astral Guardians: Cyber Fantasy",
          "Garena Speed Drifters", "Conquer Online", "EVE Echoes", "Extraordinary Ones",
          "Hero Clash", "Kingshot", "Isekai Feast: Tales of Recipes", "Heaven Burns Red",
          "Jade Dynasty: New Fantasy", "MU ORIGIN 3 Asia", "Journey Renewed: Fate Fantasy",
          "T3 Arena", "Mirage: Perfect Skyline", "X-Clash: Survival Challenge",
          "Mobile Legends: Adventure"]
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"


def curl(url: str) -> str:
    out = subprocess.run(["curl", "-sL", "--max-time", "25", "-A", UA, url],
                         capture_output=True, timeout=35)
    return out.stdout.decode("utf-8", "replace") if out.returncode == 0 else ""


def kebab(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def corner_is_empty(px) -> bool:
    r, g, b, a = px
    return a < 110 or (r >= 248 and g >= 248 and b >= 248)


def mostly_square(url: str) -> bool:
    try:
        out = subprocess.run(["curl", "-sL", "--max-time", "30", "-A", UA, url],
                             capture_output=True, timeout=40)
        img = Image.open(io.BytesIO(out.stdout)).convert("RGBA")
        w, h = img.size
        pts = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
        return sum(1 for p in pts if corner_is_empty(img.getpixel(p))) <= 1
    except Exception:
        return False


def seagm_cover(name: str) -> str | None:
    k = kebab(name)
    slugs = [f"{k}-top-up", f"{k}-diamonds-top-up", f"{k}-diamond-top-up", f"{k}-direct-top-up", k]
    pages: list[str] = []
    for slug in slugs:
        html = curl(f"https://www.seagm.com/en-us/{slug}")
        time.sleep(1.2)
        if html and "game_400" in html:
            pages.append(html)
            break
    if not pages:
        html = curl(f"https://www.seagm.com/en-us/site/search?keyword={name.replace(' ', '+')}")
        time.sleep(1.2)
        found = list(dict.fromkeys(re.findall(r'href="/en-us/([a-z0-9-]+)"', html)))
        for slug in [s for s in found if s.startswith(k.split("-")[0])][:4]:
            page = curl(f"https://www.seagm.com/en-us/{slug}")
            time.sleep(1.2)
            if page and "game_400" in page:
                pages.append(page)
                break
    for html in pages:
        m = re.search(r"https://seagm-media\.seagmcdn\.com/game_400/[\w.-]+", html)
        if m and mostly_square(m.group(0)):
            return m.group(0)
    return None


def main() -> int:
    rows = {g["name"]: g["id"] for g in json.load(open("/tmp/active-games.json"))}
    fixes, failed = [], []
    for name in FAILED:
        url = seagm_cover(name)
        if url and name in rows:
            fixes.append({"id": rows[name], "cover": url})
            print("  OK", name, "->", url[:80], flush=True)
        else:
            failed.append(name)
            print("  --", name, flush=True)
    json.dump(fixes, open("/tmp/square-fix2.json", "w"))
    print("DONE fixes:", len(fixes), "| failed:", len(failed), failed)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
