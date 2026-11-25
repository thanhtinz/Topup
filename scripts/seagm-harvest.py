#!/usr/bin/env python3
"""Thu icon gói từ SEAGM cho mọi game còn gói thiếu ảnh (chạy ngoài app vì lượt
enrich trong app kết thúc với 0 icon — nghi ngắt mạch SEAGM giữa lượt).
Logic khớp y hệt src/lib/enrich.ts: tìm trang SEAGM của game (slug đoán +
trang tìm kiếm), parse icon_sku + mệnh giá từ alt/sku, gói khớp mệnh giá
chính xác trước, không có thì mệnh giá gần nhất theo tỉ lệ log, gói không
số lấy icon nhỏ nhất. Đọc /tmp/all-pkgs.json, ghi /tmp/seagm-pkg.sql +
/tmp/seagm-harvest-report.json.
"""
import json
import math
import re
import subprocess
import time
import unicodedata
import urllib.parse

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
CACHED = {310: "https://www.seagm.com/en-us/mobile-legends-diamonds-top-up",
          187: "https://www.seagm.com/en-us/once-human-top-up"}


def curl(url: str) -> tuple[int, str]:
    out = subprocess.run(["curl", "-sL", "--max-time", "25", "-A", UA, "-w", "\n%{http_code}", url],
                         capture_output=True, timeout=35)
    if out.returncode != 0:
        return 0, ""
    body = out.stdout.decode("utf-8", "replace")
    nl = body.rfind("\n")
    try:
        return int(body[nl + 1:]), body[:nl]
    except ValueError:
        return 0, body


def norm_name(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return " ".join(re.sub(r"[^a-z0-9 ]", " ", s.lower()).split())


def kebab(s: str) -> str:
    return norm_name(s).replace(" ", "-")


def amount_of(name: str) -> int | None:
    m = re.search(r"(\d{1,3}(?:[.,]\d{3})+|\d+)", name.replace(" ", " "))
    if not m:
        return None
    n = int(m.group(1).replace(".", "").replace(",", ""))
    return n if n > 0 else None


def parse_seagm(html: str) -> dict[int, str]:
    icons: dict[int, str] = {}
    for m in re.finditer(r"https://seagm-media\.seagmcdn\.com/icon_sku/[\d-]+\.png", html):
        after = html[m.start():m.start() + 300]
        alt = re.search(r'alt="[^"]*?(\d[\d.,]*)\s*[A-Za-zÀ-ỹ]', after)
        sku = re.search(r'class="sku">\s*<span>([^<]+)', after)
        n = amount_of(alt.group(1)) if alt else None
        if n is None and sku:
            n = amount_of(sku.group(1))
        if n is not None and n not in icons:
            icons[n] = m.group(0)
    return icons


def pick_icon(icons: dict[int, str], amount: int | None) -> str | None:
    if not icons:
        return None
    if amount is not None:
        if amount in icons:
            return icons[amount]
        best = min(icons.keys(), key=lambda k: abs(math.log(amount / k)))
        return icons[best]
    return icons[min(icons.keys())]


def find_page(gid: int, name: str) -> str:
    if gid in CACHED:
        return CACHED[gid]
    k = kebab(name)
    for slug in (f"{k}-top-up", f"{k}-diamonds-top-up", f"{k}-diamond-top-up", f"{k}-uc-top-up", f"{k}-direct-top-up"):
        status, html = curl(f"https://www.seagm.com/en-us/{slug}")
        time.sleep(1.2)
        if status == 200 and "icon_sku" in html:
            return f"https://www.seagm.com/en-us/{slug}"
    status, html = curl("https://www.seagm.com/en-us/site/search?keyword=" + urllib.parse.quote(name))
    time.sleep(1.2)
    if status == 200 and html:
        slugs = list(dict.fromkeys(re.findall(r'href="/en-us/([a-z0-9-]+)"', html)))
        first = k.split("-")[0]
        for slug in [s for s in slugs if s.startswith(k) or (first in s and "top" in s)][:4]:
            status, page = curl(f"https://www.seagm.com/en-us/{slug}")
            time.sleep(1.2)
            if status == 200 and "icon_sku" in page:
                return f"https://www.seagm.com/en-us/{slug}"
    return ""


def main() -> int:
    rows = json.load(open("/tmp/all-pkgs.json"))
    games: dict[int, dict] = {}
    for r in rows:
        g = games.setdefault(r["gid"], {"name": r["gname"], "pkgs": []})
        g["pkgs"].append(r)
    todo = sorted(
        ((gid, g) for gid, g in games.items() if any(not p["img"] for p in g["pkgs"])),
        key=lambda kv: -sum(1 for p in kv[1]["pkgs"] if not p["img"]))
    print(f"games to harvest: {len(todo)}", flush=True)
    updates: list[tuple[int, str]] = []
    report = {}
    for gid, g in todo:
        page = find_page(gid, g["name"])
        if not page:
            report[g["name"]] = "no-seagm-page"
            print("  --", g["name"], "khong co trang SEAGM", flush=True)
            continue
        status, html = curl(page)
        time.sleep(1.2)
        icons = parse_seagm(html) if status == 200 else {}
        if not icons:
            report[g["name"]] = "no-icons"
            print("  --", g["name"], "trang khong co icon", flush=True)
            continue
        gained = 0
        for p in g["pkgs"]:
            if p["img"]:
                continue
            icon = pick_icon(icons, amount_of(p["pname"]))
            if icon:
                updates.append((p["pid"], icon))
                gained += 1
        report[g["name"]] = f"+{gained}"
        print(f"  OK {g['name']}: +{gained} (icons: {len(icons)})", flush=True)
    sql = "\n".join(f"UPDATE \"Package\" SET \"imageUrl\" = '{u}' WHERE id = {pid} AND \"imageUrl\" IS NULL;"
                    for pid, u in updates)
    open("/tmp/seagm-pkg.sql", "w").write(sql + "\n")
    json.dump(report, open("/tmp/seagm-harvest-report.json", "w"), ensure_ascii=False, indent=1)
    print("DONE updates:", len(updates))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
