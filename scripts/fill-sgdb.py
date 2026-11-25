#!/usr/bin/env python3
"""Điền bìa (icon vuông) + banner (hero) từ SteamGridDB cho game còn thiếu.

Đọc /tmp/missing-games.json [{id, name, cover, banner}] (xuất từ production),
ghi /tmp/sgdb-fill.json [{id, cover?, banner?}] + in thống kê.
Khớp tên: chuẩn hoá (thường, bỏ ký tự lạ) — khớp đúng tuyệt đối trước; sau đó
mới chấp nhận chứa-nhau khi phần thừa <= 2 từ (vd tiền tố hãng "Garena").
"""
import json
import re
import subprocess
import sys
import time

SGDB = "/home/hatch/workspace/custom-connectors/custom.steamgriddb/bin/sgdb.py"


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9 ]", " ", s.lower()).split()


def run(*args: str) -> dict:
    out = subprocess.run(["python3", SGDB, *args], capture_output=True, text=True, timeout=60)
    try:
        return json.loads(out.stdout or "{}")
    except json.JSONDecodeError:
        return {"success": False}


def pick_game(name: str, results: list) -> dict | None:
    want = norm(name)
    for r in results:
        if norm(r.get("name", "")) == want:
            return r
    for r in results:
        got = norm(r.get("name", ""))
        if not got:
            continue
        if len(got) > len(want):
            extra = len(got) - len(want)
            if extra <= 2 and got[-len(want):] == want or (extra <= 2 and " ".join(want) in " ".join(got)):
                return r
        elif len(want) > len(got):
            extra = len(want) - len(got)
            if extra <= 2 and " ".join(got) in " ".join(want):
                return r
    return None


def pick_cover(assets: dict) -> str | None:
    icons = [a for a in assets.get("icons", []) if (a.get("width") or 0) >= 256 and str(a.get("url", "")).endswith(".png")]
    if icons:
        icons.sort(key=lambda a: -(a.get("width") or 0))
        return icons[0]["url"]
    grids = assets.get("grids", [])
    if grids:
        return grids[0]["url"]
    return None


def pick_banner(assets: dict) -> str | None:
    heroes = assets.get("heroes", [])
    if not heroes:
        return None
    wide = [a for a in heroes if (a.get("width") or 0) >= 1600]
    pool = wide or heroes
    pool.sort(key=lambda a: abs((a.get("width") or 0) - 1920))
    return pool[0]["url"]


def main() -> int:
    rows = json.load(open("/tmp/missing-games.json"))
    fills = []
    unmatched = []
    filled_cover = filled_banner = 0
    for i, g in enumerate(rows):
        res = run("search", g["name"])
        data = res.get("data") or []
        game = pick_game(g["name"], data)
        if not game:
            unmatched.append(g["name"])
            continue
        assets = run("assets", str(game["id"]))
        entry = {"id": g["id"]}
        if not g["cover"]:
            c = pick_cover(assets)
            if c:
                entry["cover"] = c
                filled_cover += 1
        if not g["banner"]:
            b = pick_banner(assets)
            if b:
                entry["banner"] = b
                filled_banner += 1
        if len(entry) > 1:
            fills.append(entry)
        if (i + 1) % 25 == 0:
            print(f"...{i + 1}/{len(rows)} cover+{filled_cover} banner+{filled_banner}", flush=True)
        time.sleep(0.25)
    json.dump(fills, open("/tmp/sgdb-fill.json", "w"))
    print(f"DONE games={len(rows)} fillRows={len(fills)} covers={filled_cover} banners={filled_banner}")
    print("UNMATCHED:", json.dumps(unmatched, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
