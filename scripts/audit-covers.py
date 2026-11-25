#!/usr/bin/env python3
"""Rà soát bìa game đang bán: bìa nào là ảnh BO GÓC NGUỒN (góc trắng/trong suốt)
hoặc bìa bị "ép vuông" (/uploads/sq-cover-*) thì tìm ảnh VUÔNG THẬT thay thế
từ SteamGridDB (icon full-bleed hoặc grid 600x900), kiểm góc ảnh thay thế
trước khi nhận. Đọc /tmp/active-games.json, ghi /tmp/square-fix.json.
"""
import io
import json
import re
import subprocess
import time
import urllib.request

from PIL import Image

SGDB = "/home/hatch/workspace/custom-connectors/custom.steamgriddb/bin/sgdb.py"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"}


def norm(s: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9 ]", " ", s.lower()).split())


def load_image(url: str) -> Image.Image | None:
    # Tải bằng curl: urllib qua proxy của sandbox hay bị cắt giữa chừng
    # (IncompleteRead) với ảnh lớn vài trăm KB.
    try:
        out = subprocess.run(
            ["curl", "-sL", "--max-time", "30", "-A", UA["User-Agent"], url],
            capture_output=True, timeout=40)
        if out.returncode != 0 or not out.stdout:
            return None
        return Image.open(io.BytesIO(out.stdout)).convert("RGBA")
    except Exception:
        return None


def corner_is_empty(px) -> bool:
    r, g, b, a = px
    return a < 110 or (r >= 248 and g >= 248 and b >= 248)


def rounded_corners(img: Image.Image) -> bool:
    """True nếu cả 4 góc đều trống (trắng/trong) = ảnh bo góc nướng sẵn."""
    w, h = img.size
    pts = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    return all(corner_is_empty(img.getpixel(p)) for p in pts)


def mostly_square(img: Image.Image) -> bool:
    """Ảnh thay thế đạt chuẩn vuông thật: tối đa 1 góc trống."""
    w, h = img.size
    pts = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    return sum(1 for p in pts if corner_is_empty(img.getpixel(p))) <= 1


def sgdb_call(*args: str) -> dict:
    out = subprocess.run(["python3", SGDB, *args], capture_output=True, text=True, timeout=60)
    try:
        return json.loads(out.stdout or "{}")
    except json.JSONDecodeError:
        return {}


def find_square_replacement(name: str) -> str | None:
    res = sgdb_call("search", name)
    time.sleep(0.2)
    data = res.get("data") or []
    pick = None
    for r in data:
        if norm(r.get("name", "")) == norm(name):
            pick = r
            break
    if not pick:
        for r in data:
            got = norm(r.get("name", "")).split()
            want = norm(name).split()
            if len(got) > len(want) and len(got) - len(want) <= 2 and " ".join(want) in " ".join(got):
                pick = r
                break
    if not pick:
        return None
    assets = sgdb_call("assets", str(pick["id"]))
    time.sleep(0.2)
    cands: list[str] = []
    icons = [a for a in assets.get("icons", []) if (a.get("width") or 0) >= 256 and str(a.get("url", "")).endswith(".png")]
    icons.sort(key=lambda a: -(a.get("width") or 0))
    cands += [a["url"] for a in icons]
    cands += [a["url"] for a in assets.get("grids", [])]
    for url in cands[:4]:
        img = load_image(url)
        if img is not None and mostly_square(img):
            return url
    return None


def main() -> int:
    rows = json.load(open("/tmp/active-games.json"))
    flagged: list[dict] = []
    for g in rows:
        cover = g["cover"] or ""
        if cover.startswith("/uploads/sq-cover-"):
            flagged.append({"id": g["id"], "name": g["name"], "why": "ep-vuong"})
            continue
        if not cover or cover.startswith("/uploads/"):
            continue
        img = load_image(cover)
        if img is not None and rounded_corners(img):
            flagged.append({"id": g["id"], "name": g["name"], "why": "bo-goc-nguon"})
    print(f"flagged: {len(flagged)}", flush=True)
    fixes = []
    failed = []
    for f in flagged:
        url = find_square_replacement(f["name"])
        if url:
            fixes.append({"id": f["id"], "cover": url})
            print("  OK", f["name"], "->", url[:80], flush=True)
        else:
            failed.append(f["name"])
            print("  --", f["name"], "khong tim duoc anh vuong", flush=True)
    json.dump(fixes, open("/tmp/square-fix.json", "w"))
    print("DONE fixes:", len(fixes), "| failed:", len(failed))
    print("FAILED:", json.dumps(failed, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
