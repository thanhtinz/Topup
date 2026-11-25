#!/usr/bin/env python3
"""Thu icon gói SEAGM vòng 2: lấy danh sách slug THẬT từ trang danh mục
/en-us/direct-topup của SEAGM (vòng 1 đoán slug nên trượt 169 game — slug
thật kiểu gi-crystals không đoán được), khớp slug theo token tên game rồi
parse icon mệnh giá như enrich.ts. Đọc /tmp/all-pkgs.json (xuất mới sau
vòng 1), ghi /tmp/seagm-pkg2.sql + /tmp/seagm-harvest2-report.json.
"""
import json
import math
import re
import subprocess
import time
import unicodedata

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"


def curl(url: str) -> tuple[int, str]:
    out = subprocess.run(["curl", "-sL", "--max-time", "30", "-A", UA, "-w", "\n%{http_code}", url],
                         capture_output=True, timeout=40)
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


def stem(tok: str) -> str:
    return tok[:-1] if tok.endswith("s") and len(tok) > 3 else tok


def tokens(s: str) -> list[str]:
    return [stem(t) for t in norm_name(s).split() if t not in ("top", "up")]


def amount_of(name: str) -> int | None:
    m = re.search(r"(\d{1,3}(?:[.,]\d{3})+|\d+)", name)
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


def slug_candidates(slugs: list[str], game_name: str) -> list[str]:
    gt = tokens(game_name)
    if not gt:
        return []
    scored = []
    for slug in slugs:
        st = [stem(t) for t in slug.split("-") if t not in ("top", "up")]
        hit = sum(1 for t in gt if t in st)
        # Nhận khi: mọi token tên game đều có trong slug, hoặc thiếu tối đa 1
        # token (vd hậu tố khu vực) mà token đầu khớp.
        if hit == len(gt) or (hit >= len(gt) - 1 and gt[0] in st and len(gt) >= 3):
            scored.append((len(st) - hit, slug))
    scored.sort()
    return [s for _, s in scored[:3]]


def main() -> int:
    status, html = curl("https://www.seagm.com/en-us/direct-topup")
    slugs = sorted(set(re.findall(r'href="/en-us/([a-z0-9-]+)"', html)))
    print(f"catalog slugs: {len(slugs)}", flush=True)
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
    page_cache: dict[str, dict[int, str]] = {}
    for gid, g in todo:
        cands = slug_candidates(slugs, g["name"])
        icons: dict[int, str] = {}
        used = ""
        for slug in cands:
            if slug not in page_cache:
                st2, page = curl(f"https://www.seagm.com/en-us/{slug}")
                time.sleep(1.2)
                page_cache[slug] = parse_seagm(page) if st2 == 200 else {}
            if page_cache[slug]:
                icons = page_cache[slug]
                used = slug
                break
        if not icons:
            report[g["name"]] = "no-catalog-match"
            print("  --", g["name"], flush=True)
            continue
        gained = 0
        for p in g["pkgs"]:
            if p["img"]:
                continue
            icon = pick_icon(icons, amount_of(p["pname"]))
            if icon:
                updates.append((p["pid"], icon))
                gained += 1
        report[g["name"]] = f"+{gained} via {used}"
        print(f"  OK {g['name']}: +{gained} ({used})", flush=True)
    sql = "\n".join(f"UPDATE \"Package\" SET \"imageUrl\" = '{u}' WHERE id = {pid} AND \"imageUrl\" IS NULL;"
                    for pid, u in updates)
    open("/tmp/seagm-pkg2.sql", "w").write(sql + "\n")
    json.dump(report, open("/tmp/seagm-harvest2-report.json", "w"), ensure_ascii=False, indent=1)
    print("DONE updates:", len(updates))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
