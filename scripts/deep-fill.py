#!/usr/bin/env python3
"""Quét sâu điền thể loại / bìa / banner / mô tả cho game còn thiếu.

Nguồn: iTunes Search (thể loại + bìa + mô tả), Steam store (thể loại + mô tả +
banner + bìa dọc), SteamGridDB (bìa icon + banner hero). Khớp tên NGHIÊM NGẶT:
bằng nhau sau chuẩn hoá, hoặc tên store bắt đầu bằng tên game (biến thể đã làm
sạch hậu tố khu vực như "(United States)", "SEA", "- Activision").
Đọc /tmp/all-games.json, ghi /tmp/deep-fill.json [{id, genre?, cover?, banner?, desc?}].
"""
import json
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request

SGDB = "/home/hatch/workspace/custom-connectors/custom.steamgriddb/bin/sgdb.py"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"}

GENRE_MAP = {
    "Action": "Hành động", "Adventure": "Phiêu lưu", "Role-Playing": "Nhập vai",
    "RPG": "Nhập vai", "MMO": "Nhập vai", "Massively Multiplayer": "Nhập vai",
    "Strategy": "Chiến thuật", "Simulation": "Mô phỏng", "Puzzle": "Giải đố",
    "Racing": "Đua xe", "Sports": "Thể thao", "Card": "Thẻ bài", "Board": "Cờ bàn",
    "Music": "Âm nhạc", "Casual": "Giải trí nhẹ", "Arcade": "Giải trí",
    "Entertainment": "Giải trí", "Casino": "Casino", "Family": "Gia đình",
    # Không map "Social Networking" / "Photo & Video": đó là hạng mục app, không
    # phải thể loại game — điền vào game thật là sai (đã dính ở Tomb Busters).
}


def norm(s: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9 ]", " ", s.lower()).split())


def variants(name: str) -> list[str]:
    out: list[str] = []
    def add(v: str):
        v = " ".join(v.split()).strip(" -:")
        if v and v not in out:
            out.append(v)
    add(name)
    no_paren = re.sub(r"\([^)]*\)", " ", name)
    add(no_paren)
    base = no_paren
    for suf in (" SEA", " Global", " PC", " Mobile", " - Activision", " (United States)"):
        if base.lower().endswith(suf.lower()):
            base = base[: -len(suf)]
    add(base)
    add(re.sub(r"\s+-\s+.*$", "", base))  # bỏ hậu tố sau " - "
    return out


def fetch_json(url: str, timeout: int = 25):
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8", "replace"))
    except Exception:
        return None


def head_ok(url: str) -> bool:
    req = urllib.request.Request(url, headers=UA, method="HEAD")
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status == 200
    except Exception:
        return False


def match_store(store_name: str, var: str) -> bool:
    ns, nv = norm(store_name), norm(var)
    if ns == nv:
        return True
    return len(nv) >= 5 and ns.startswith(nv)


def map_genre(cands: list[str]) -> str | None:
    for c in cands:
        if c in GENRE_MAP:
            return GENRE_MAP[c]
    return None


def try_itunes(game: dict, entry: dict) -> None:
    for var in variants(game["name"]):
        data = fetch_json("https://itunes.apple.com/search?" + urllib.parse.urlencode(
            {"term": var, "entity": "software", "limit": 10}))
        time.sleep(0.2)
        if not data:
            continue
        for res in data.get("results", []):
            if not match_store(res.get("trackName", ""), var):
                continue
            if not entry.get("genre"):
                g = map_genre([*(res.get("genres") or []), res.get("primaryGenreName", "")])
                if g:
                    entry["genre"] = g
            if not entry.get("cover") and res.get("artworkUrl512"):
                entry["cover"] = res["artworkUrl512"].replace("512x512bb", "1024x1024bb")
            if not entry.get("desc") and res.get("description"):
                entry["desc"] = res["description"][:4000]
            return


def try_steam(game: dict, entry: dict) -> None:
    for var in variants(game["name"]):
        data = fetch_json("https://store.steampowered.com/api/storesearch/?" + urllib.parse.urlencode(
            {"term": var, "l": "english", "cc": "US"}))
        time.sleep(0.2)
        if not data:
            continue
        hit = None
        for item in data.get("items", []):
            if norm(item.get("name", "")) == norm(var):
                hit = item
                break
        if not hit:
            continue
        appid = hit["id"]
        det = fetch_json(f"https://store.steampowered.com/api/appdetails?appids={appid}&l=english")
        time.sleep(0.2)
        info = (det or {}).get(str(appid), {}).get("data") or {}
        if not entry.get("genre"):
            g = map_genre([x.get("description", "") for x in info.get("genres", [])])
            if g:
                entry["genre"] = g
        if not entry.get("desc") and info.get("short_description"):
            entry["desc"] = info["short_description"][:4000]
        if not entry.get("banner") and info.get("header_image"):
            entry["banner"] = info["header_image"]
        if not entry.get("cover"):
            lib = f"https://cdn.akamai.steamstatic.com/steam/apps/{appid}/library_600x900.jpg"
            if head_ok(lib):
                entry["cover"] = lib
        return


def sgdb_call(*args: str) -> dict:
    out = subprocess.run(["python3", SGDB, *args], capture_output=True, text=True, timeout=60)
    try:
        return json.loads(out.stdout or "{}")
    except json.JSONDecodeError:
        return {}


def try_sgdb(game: dict, entry: dict) -> None:
    for var in variants(game["name"]):
        res = sgdb_call("search", var)
        time.sleep(0.2)
        data = res.get("data") or []
        pick = None
        for r in data:
            if norm(r.get("name", "")) == norm(var):
                pick = r
                break
        if not pick:
            continue
        assets = sgdb_call("assets", str(pick["id"]))
        time.sleep(0.2)
        if not entry.get("cover"):
            icons = [a for a in assets.get("icons", []) if (a.get("width") or 0) >= 256 and str(a.get("url", "")).endswith(".png")]
            if icons:
                icons.sort(key=lambda a: -(a.get("width") or 0))
                entry["cover"] = icons[0]["url"]
            elif assets.get("grids"):
                entry["cover"] = assets["grids"][0]["url"]
        if not entry.get("banner"):
            heroes = assets.get("heroes", [])
            wide = [a for a in heroes if (a.get("width") or 0) >= 1600]
            pool = wide or heroes
            if pool:
                pool.sort(key=lambda a: abs((a.get("width") or 0) - 1920))
                entry["banner"] = pool[0]["url"]
        return


def main() -> int:
    rows = json.load(open("/tmp/all-games.json"))
    todo = [g for g in rows if not g["genre"] or not g["cover"] or not g["banner"] or not g["desc"]]
    print(f"todo: {len(todo)} games", flush=True)
    fills = []
    counts = {"genre": 0, "cover": 0, "banner": 0, "desc": 0}
    for i, g in enumerate(todo):
        entry: dict = {"id": g["id"]}
        need = {"genre": not g["genre"], "cover": not g["cover"], "banner": not g["banner"], "desc": not g["desc"]}
        try_itunes(g, entry)
        if need["genre"] and not entry.get("genre") or need["desc"] and not entry.get("desc") or need["banner"] and not entry.get("banner") or need["cover"] and not entry.get("cover"):
            try_steam(g, entry)
        if need["cover"] and not entry.get("cover") or need["banner"] and not entry.get("banner"):
            try_sgdb(g, entry)
        got = {k: entry[k] for k in ("genre", "cover", "banner", "desc") if entry.get(k) and need[k]}
        if got:
            fills.append({"id": g["id"], **got})
            for k in got:
                counts[k] += 1
        if (i + 1) % 20 == 0:
            print(f"...{i + 1}/{len(todo)} {counts}", flush=True)
    json.dump(fills, open("/tmp/deep-fill.json", "w"))
    print("DONE", counts, "rows:", len(fills))
    filled_ids = {f["id"] for f in fills}
    for field in ("genre", "cover"):
        still = [g["name"] for g in todo if not g[field] and not any(f["id"] == g["id"] and f.get(field) for f in fills)]
        print(f"STILL MISSING {field} ({len(still)}):", json.dumps(still, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
